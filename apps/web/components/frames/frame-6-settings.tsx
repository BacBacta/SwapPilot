"use client";

import { CardLight } from "@/components/ui/surfaces";
import { Toggle } from "@/components/ui/primitives";
import { useSettings } from "@/components/providers/settings-provider";

const SLIPPAGE_PRESETS = [50, 100, 200, 500]; // 0.5%, 1%, 2%, 5%

export function FrameSettingsPanel() {
  const { settings, updateSettings, resetSettings } = useSettings();

  return (
    <CardLight className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-sp-lightBorder bg-sp-lightSurface px-4 py-3">
        <div className="text-xs font-semibold text-sp-lightText">Settings</div>
        <div className="text-[11px] text-sp-lightMuted">Paramètres de scoring</div>
      </div>

      <div className="p-4 space-y-4">
        {/* Slippage Tolerance */}
        <div className="rounded-lg border border-sp-lightBorder bg-sp-lightSurface p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-sp-lightText">Slippage Tolerance</div>
              <div className="text-[10px] text-sp-lightMuted mt-0.5">
                Tolérance maximale de glissement de prix
              </div>
            </div>
            <div className="text-sm font-bold text-sp-lightText">
              {settings.autoSlippage ? (
                <span className="text-sp-accent">Auto</span>
              ) : (
                `${(settings.slippageBps / 100).toFixed(2)}%`
              )}
            </div>
          </div>

          {/* Auto-slippage toggle */}
          <div className="mt-3 flex items-center justify-between rounded-md border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-sp-lightText">⚡ Auto-Slippage</span>
              <span className="text-[10px] text-sp-lightMuted">
                Ajusté selon le risque du token
              </span>
            </div>
            <Toggle
              on={settings.autoSlippage}
              onChange={(on) => updateSettings({ autoSlippage: on })}
            />
          </div>

          {/* Manual slippage controls - shown when auto is off or as fallback */}
          <div className={`mt-3 ${settings.autoSlippage ? 'opacity-50' : ''}`}>
            <div className="text-[10px] text-sp-lightMuted mb-2">
              {settings.autoSlippage ? 'Slippage minimum (fallback)' : 'Slippage manuel'}
            </div>
            <div className="flex gap-2">
              {SLIPPAGE_PRESETS.map((bps) => (
                <button
                  key={bps}
                  onClick={() => updateSettings({ slippageBps: bps })}
                  className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all ${
                    settings.slippageBps === bps
                      ? 'bg-sp-lightText text-white'
                      : 'border border-sp-lightBorder bg-sp-lightSurface2 text-sp-lightText hover:bg-sp-lightBorder'
                  }`}
                >
                  {(bps / 100).toFixed(bps % 100 === 0 ? 0 : 1)}%
                </button>
              ))}
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={settings.slippageBps}
              onChange={(e) => updateSettings({ slippageBps: Number(e.target.value) })}
              className="mt-3 w-full accent-sp-accent"
            />
          </div>
        </div>

        {/* Mode Selector */}
        <div className="rounded-lg border border-sp-lightBorder bg-sp-lightSurface p-3">
          <div className="text-[11px] font-semibold text-sp-lightText">Mode de scoring</div>
          <div className="text-[10px] text-sp-lightMuted mt-0.5 mb-3">
            Ajuste la pondération risque/rendement
          </div>
          <div className="flex gap-2">
            {(['SAFE', 'NORMAL', 'DEGEN'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateSettings({ mode })}
                className={`flex-1 rounded-md px-2 py-2 text-[11px] font-semibold transition-all ${
                  settings.mode === mode
                    ? mode === 'SAFE'
                      ? 'bg-green-600 text-white'
                      : mode === 'DEGEN'
                        ? 'bg-orange-600 text-white'
                        : 'bg-sp-lightText text-white'
                    : 'border border-sp-lightBorder bg-sp-lightSurface2 text-sp-lightText hover:bg-sp-lightBorder'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-sp-lightMuted">
            {settings.mode === 'SAFE' && '🛡️ Exclut les quotes à risque élevé. Privilégie la sécurité.'}
            {settings.mode === 'NORMAL' && '⚖️ Équilibre entre rendement et risque.'}
            {settings.mode === 'DEGEN' && '🔥 Maximise le rendement brut. Affiche les risques.'}
          </div>
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-3">
            <div>
              <div className="text-[11px] font-semibold text-sp-lightText">Sellability Check</div>
              <div className="text-[10px] text-sp-lightMuted">
                Vérifie si le token peut être revendu
              </div>
            </div>
            <Toggle
              on={settings.sellabilityCheck}
              onChange={(on) => updateSettings({ sellabilityCheck: on })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-3">
            <div>
              <div className="text-[11px] font-semibold text-sp-lightText">MEV-Aware Scoring</div>
              <div className="text-[10px] text-sp-lightMuted">
                Pénalise les routes exposées au MEV
              </div>
            </div>
            <Toggle
              on={settings.mevAwareScoring}
              onChange={(on) => updateSettings({ mevAwareScoring: on })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-sp-lightBorder bg-sp-lightSurface px-3 py-3">
            <div>
              <div className="text-[11px] font-semibold text-sp-lightText">Canonical Pools Only</div>
              <div className="text-[10px] text-sp-lightMuted">
                Limite aux pools vérifiées et stables
              </div>
            </div>
            <Toggle
              on={settings.canonicalPoolsOnly}
              onChange={(on) => updateSettings({ canonicalPoolsOnly: on })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={resetSettings}
            className="rounded-md border border-sp-lightBorder bg-sp-lightSurface2 px-3 py-2 text-[11px] font-semibold text-sp-lightText hover:bg-sp-lightBorder transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Status indicator */}
        <div className="text-[10px] text-sp-lightMuted text-center pt-2 border-t border-sp-lightBorder">
          ✓ Settings sauvegardés automatiquement
        </div>
      </div>
    </CardLight>
  );
}
