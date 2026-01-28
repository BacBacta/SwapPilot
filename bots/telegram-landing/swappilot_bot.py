import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Optional

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
)


# ---------- Logging ----------
logging.basicConfig(format="%(asctime)s | %(levelname)s | %(message)s", level=logging.INFO)
logger = logging.getLogger(__name__)


def _load_env_file_manual(env_path: Path) -> None:
    """
    Minimal .env loader fallback (handles UTF-8/UTF-16 saved by Notepad).
    - Does NOT override already-set environment variables.
    - Ignores comments and blank lines.
    """
    if not env_path.exists():
        return

    raw = env_path.read_bytes()

    # Notepad often saves as UTF-16; tokens/usernames are ASCII, so removing NUL bytes is safe
    # and makes parsing resilient even if decoding guesses fail.
    if b"\x00" in raw:
        raw = raw.replace(b"\x00", b"")
    text: Optional[str] = None
    for enc in ("utf-8-sig", "utf-16", "utf-16-le", "utf-16-be", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except Exception:
            continue

    if text is None:
        return

    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.lower().startswith("export "):
            s = s[7:].strip()

        # Accept common separators:
        # - KEY=VALUE   (recommended)
        # - KEY: VALUE  (common in copied docs)
        # - KEY VALUE   (common typo)
        key = ""
        val = ""
        if "=" in s:
            k, v = s.split("=", 1)
            key = k.strip().lstrip("\ufeff")
            val = v.strip()
        elif ":" in s:
            k, v = s.split(":", 1)
            key = k.strip().lstrip("\ufeff")
            val = v.strip()
        else:
            parts = s.split(None, 1)
            if len(parts) == 2:
                key = parts[0].strip().lstrip("\ufeff")
                val = parts[1].strip()
            else:
                continue

        # Strip common quotes (including “smart quotes” from some editors)
        val = val.strip().strip("'").strip('"').strip("“").strip("”")
        if not key:
            continue

        # Override only if not set OR set to empty (common on Windows/PowerShell).
        if key not in os.environ or (os.environ.get(key, "").strip() == ""):
            os.environ[key] = val


def load_local_env() -> None:
    """Load `.env` next to this script (python-dotenv if possible, else manual)."""
    env_path = Path(__file__).with_name(".env")

    # Try python-dotenv first (nice parsing rules), then fallback.
    try:
        from dotenv import load_dotenv  # type: ignore

        # Do not override real values, but if the var exists and is empty, we want .env to win.
        # python-dotenv doesn't have "override only empty", so we do: first pass no-override,
        # then fallback manual loader that overrides empties.
        load_dotenv(dotenv_path=env_path, override=False)
    except Exception:
        _load_env_file_manual(env_path)
    else:
        # Still fallback if BOT_TOKEN wasn't picked up (common with UTF-16 .env or empty env var)
        if not os.environ.get("BOT_TOKEN", "").strip():
            _load_env_file_manual(env_path)


load_local_env()


def _env_file_info(path: Path) -> str:
    if not path.exists():
        return f"{path.name}: missing"
    try:
        size = path.stat().st_size
    except Exception:
        size = -1
    return f"{path.name}: exists (size={size} bytes)"


def _env_has_key(path: Path, key: str) -> bool:
    if not path.exists():
        return False
    raw = path.read_bytes()
    text: Optional[str] = None
    for enc in ("utf-8-sig", "utf-16", "utf-16-le", "utf-16-be", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except Exception:
            continue
    if text is None:
        return False

    needle = key.strip().upper()
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.lower().startswith("export "):
            s = s[7:].strip()
        # Accept spaces around '='
        if "=" in s:
            k = s.split("=", 1)[0].strip().lstrip("\ufeff").upper()
            if k == needle:
                return True
        else:
            # Common typo: "BOT_TOKEN: xxx" or "BOT_TOKEN xxx"
            k = s.split(None, 1)[0].strip().lstrip("\ufeff").upper()
            if k == needle:
                return True
    return False


def _extract_env_value(path: Path, key: str) -> str:
    """Extract KEY value from .env-like file (best-effort). Returns '' if missing/unparseable."""
    if not path.exists():
        return ""
    raw = path.read_bytes()
    if b"\x00" in raw:
        raw = raw.replace(b"\x00", b"")
    text: Optional[str] = None
    for enc in ("utf-8-sig", "utf-16", "utf-16-le", "utf-16-be", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except Exception:
            continue
    if text is None:
        return ""

    needle = key.strip().upper()
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        if s.lower().startswith("export "):
            s = s[7:].strip()

        k = ""
        v = ""
        if "=" in s:
            k, v = s.split("=", 1)
        elif ":" in s:
            k, v = s.split(":", 1)
        else:
            parts = s.split(None, 1)
            if len(parts) == 2:
                k, v = parts[0], parts[1]
            else:
                continue

        kk = k.strip().lstrip("\ufeff").upper()
        if kk != needle:
            continue

        vv = v.strip().strip("'").strip('"').strip("“").strip("”")
        return vv

    return ""


# ---------- Configuration (env vars) ----------
BOT_TOKEN = os.environ.get("BOT_TOKEN", "").strip()
CHANNEL_USERNAME = os.environ.get("CHANNEL_USERNAME", "").strip()  # e.g. "SwapPilot_Official" (without @)
GROUP_USERNAME = os.environ.get("GROUP_USERNAME", "").strip()  # optional (without @)
GROUP_INVITE_LINK = os.environ.get("GROUP_INVITE_LINK", "").strip()  # optional if group is private
DB_PATH = os.environ.get("DB_PATH", "").strip() or "swappilot.db"

# Optional (recommended when group is private / username changes)
CHANNEL_CHAT_ID = os.environ.get("CHANNEL_CHAT_ID", "").strip()  # e.g. -1001234567890
GROUP_CHAT_ID = os.environ.get("GROUP_CHAT_ID", "").strip()  # e.g. -1001234567890

if not BOT_TOKEN:
    script_dir = Path(__file__).resolve().parent
    env_path = script_dir / ".env"
    env_txt_path = script_dir / ".env.txt"
    env_file_token = _extract_env_value(env_path, "BOT_TOKEN")
    env_file_token_len = len(env_file_token)
    env_var_present = "BOT_TOKEN" in os.environ
    env_var_len = len(os.environ.get("BOT_TOKEN", "") or "")
    env_var_has_colon = ":" in (os.environ.get("BOT_TOKEN", "") or "")
    env_file_has_colon = ":" in env_file_token
    msg = (
        "Missing BOT_TOKEN env var.\n\n"
        "Quick fixes:\n"
        "- Put it in .env next to swappilot_bot.py as: BOT_TOKEN=123:ABC\n"
        "- Or in PowerShell: $env:BOT_TOKEN=\"123:ABC\" then run again\n\n"
        "Diagnostics:\n"
        f"- cwd: {os.getcwd()}\n"
        f"- script_dir: {script_dir}\n"
        f"- env BOT_TOKEN present: {env_var_present} (len={env_var_len}, contains_colon={env_var_has_colon})\n"
        f"- .env BOT_TOKEN extracted: (len={env_file_token_len}, contains_colon={env_file_has_colon})\n"
        f"- {_env_file_info(env_path)} (BOT_TOKEN key detected: {_env_has_key(env_path, 'BOT_TOKEN')})\n"
        f"- {_env_file_info(env_txt_path)} (BOT_TOKEN key detected: {_env_has_key(env_txt_path, 'BOT_TOKEN')})\n"
    )
    raise RuntimeError(msg)
if not CHANNEL_USERNAME and not CHANNEL_CHAT_ID:
    raise RuntimeError(
        "Missing CHANNEL_USERNAME or CHANNEL_CHAT_ID env var. "
        "Example: set CHANNEL_USERNAME=SwapPilot_Official"
    )


def _parse_int(s: str) -> Optional[int]:
    try:
        return int(s)
    except Exception:
        return None


CHANNEL_CHAT_ID_INT = _parse_int(CHANNEL_CHAT_ID) if CHANNEL_CHAT_ID else None
GROUP_CHAT_ID_INT = _parse_int(GROUP_CHAT_ID) if GROUP_CHAT_ID else None


def channel_ref() -> str | int:
    return CHANNEL_CHAT_ID_INT if CHANNEL_CHAT_ID_INT is not None else f"@{CHANNEL_USERNAME}"


def group_ref() -> Optional[str | int]:
    if GROUP_CHAT_ID_INT is not None:
        return GROUP_CHAT_ID_INT
    if GROUP_USERNAME:
        return f"@{GROUP_USERNAME}"
    return None


def channel_url() -> str:
    if not CHANNEL_USERNAME:
        # No clean URL if you only provide chat_id; keep it explicit.
        return "Open the channel from Telegram search (channel username not configured)."
    return f"https://t.me/{CHANNEL_USERNAME}"


def group_url() -> Optional[str]:
    if GROUP_INVITE_LINK:
        return GROUP_INVITE_LINK
    if GROUP_USERNAME:
        return f"https://t.me/{GROUP_USERNAME}"
    return None


@dataclass(frozen=True)
class UserContext:
    user_id: int
    start_param: str


# ---------- Database (thread-safe) ----------
db = sqlite3.connect(DB_PATH, check_same_thread=False)
db.execute("PRAGMA journal_mode=WAL;")
db.execute("PRAGMA synchronous=NORMAL;")
db_lock = threading.Lock()


def db_exec(sql: str, params: tuple = ()) -> None:
    with db_lock:
        db.execute(sql, params)
        db.commit()


def db_query_one(sql: str, params: tuple = ()) -> Optional[tuple]:
    with db_lock:
        cur = db.execute(sql, params)
        return cur.fetchone()


def init_db() -> None:
    db_exec(
        """
CREATE TABLE IF NOT EXISTS starts (
  user_id INTEGER,
  start_param TEXT,
  ts INTEGER
)
"""
    )
    db_exec(
        """
CREATE TABLE IF NOT EXISTS events (
  user_id INTEGER,
  event TEXT,
  meta TEXT,
  ts INTEGER
)
"""
    )
    db_exec(
        """
CREATE TABLE IF NOT EXISTS user_state (
  user_id INTEGER PRIMARY KEY,
  last_start_param TEXT,
  last_seen_ts INTEGER
)
"""
    )


def set_user_state(user_id: int, start_param: str) -> None:
    db_exec(
        """
INSERT INTO user_state(user_id, last_start_param, last_seen_ts)
VALUES(?,?,?)
ON CONFLICT(user_id) DO UPDATE SET
  last_start_param=excluded.last_start_param,
  last_seen_ts=excluded.last_seen_ts
""",
        (user_id, start_param, int(time.time())),
    )


def get_user_ctx(user_id: int) -> UserContext:
    row = db_query_one("SELECT last_start_param FROM user_state WHERE user_id=?", (user_id,))
    start_param = (row[0] if row and row[0] else "") if row else ""
    return UserContext(user_id=user_id, start_param=start_param)


def log_event(user_id: int, event: str, meta: dict) -> None:
    payload = dict(meta)
    # Always attach the last known campaign if present
    if "start_param" not in payload:
        payload["start_param"] = get_user_ctx(user_id).start_param
    db_exec("INSERT INTO events VALUES (?,?,?,?)", (user_id, event, json.dumps(payload), int(time.time())))


# ---------- UI ----------
def build_keyboard(stage: str = "landing") -> InlineKeyboardMarkup:
    """
    stage:
      - landing: CTA -> join channel (tracked), join group (tracked), verify
      - after_link: after we showed a link, keep verify handy
    """
    buttons: list[list[InlineKeyboardButton]] = []

    # Tracked CTAs (callbacks) so we can measure taps
    buttons.append([InlineKeyboardButton("✅ Join the official channel", callback_data="go_channel")])

    if group_url():
        buttons.append([InlineKeyboardButton("💬 Join the community group", callback_data="go_group")])

    buttons.append([InlineKeyboardButton("🔎 Verify access", callback_data="verify")])
    return InlineKeyboardMarkup(buttons)


LANDING_TEXT = (
    "Welcome to SwapPilot.\n\n"
    "⚠️ Security notice: admins will NEVER DM you first and we will NEVER ask for seed phrases, private keys, "
    "passwords, or remote access.\n\n"
    "1) Join the official channel\n"
    "2) (Optional) Join the community group\n"
    "3) Tap “Verify” to confirm access"
)


# ---------- Handlers ----------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Entry point. Captures ?start=... parameter for campaign tracking."""
    if not update.message:
        return

    user = update.effective_user
    start_param = context.args[0] if context.args else ""

    db_exec("INSERT INTO starts VALUES (?,?,?)", (user.id, start_param, int(time.time())))
    set_user_state(user.id, start_param)
    log_event(user.id, "start", {"start_param": start_param})
    log_event(user.id, "landing_shown", {"start_param": start_param, "message_version": "v1"})

    await update.message.reply_text(LANDING_TEXT, reply_markup=build_keyboard("landing"))


async def on_button(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline button clicks."""
    query = update.callback_query
    if not query:
        return

    await query.answer()
    user_id = query.from_user.id
    uctx = get_user_ctx(user_id)

    if query.data == "go_channel":
        log_event(user_id, "tap_channel", {"start_param": uctx.start_param})
        await query.edit_message_text(
            f"Join the official channel here:\n{channel_url()}\n\nThen come back and tap Verify.",
            reply_markup=build_keyboard("after_link"),
        )
        return

    if query.data == "go_group":
        link = group_url()
        log_event(user_id, "tap_group", {"start_param": uctx.start_param})
        if not link:
            await query.edit_message_text("Group is not configured.", reply_markup=build_keyboard("landing"))
            return
        await query.edit_message_text(
            f"Join the community group here:\n{link}\n\nThen come back and tap Verify.",
            reply_markup=build_keyboard("after_link"),
        )
        return

    if query.data == "verify":
        log_event(user_id, "verify_click", {"start_param": uctx.start_param})

        ok_channel = await check_membership(context, channel_ref(), user_id)

        ok_group: Optional[bool] = None
        gref = group_ref()
        if gref is not None:
            ok_group = await check_membership(context, gref, user_id)

        meta = {"start_param": uctx.start_param, "channel": ok_channel, "group": ok_group}
        log_event(user_id, "verify_result", meta)

        msg = "Verification result:\n"
        msg += f"- Channel: {'✅' if ok_channel else '❌'}\n"

        if gref is not None:
            msg += f"- Group: {'✅' if ok_group else '❌'}\n"
        elif GROUP_INVITE_LINK:
            msg += "- Group: ⚠️ Cannot auto-verify from invite link alone. Please join and come back.\n"
        else:
            msg += "- Group: (not configured)\n"

        if not ok_channel:
            msg += "\nTo access updates, you must join the official channel first."
        msg += "\n\nIf you just joined, wait 5–10 seconds and try again."

        await query.edit_message_text(msg, reply_markup=build_keyboard("landing"))
        return


async def check_membership(context: ContextTypes.DEFAULT_TYPE, chat: str | int, user_id: int) -> bool:
    """
    Returns True if the user is a member/admin/creator of the given chat (channel/group).
    Notes:
    - For channels, the bot often needs to be an administrator to reliably access membership info.
    - If this fails, we return False and log a warning (so your stats can identify false negatives).
    """
    try:
        member = await context.bot.get_chat_member(chat_id=chat, user_id=user_id)
        return member.status in ("member", "administrator", "creator")
    except Exception as e:
        logger.warning("check_membership failed for chat=%s user_id=%s: %s", chat, user_id, e)
        log_event(user_id, "check_membership_failed", {"chat": str(chat), "error": str(e)})
        return False


def main() -> None:
    init_db()
    app = ApplicationBuilder().token(BOT_TOKEN).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(on_button))

    logger.info("Telegram landing bot started (polling)...")
    app.run_polling()


if __name__ == "__main__":
    main()

