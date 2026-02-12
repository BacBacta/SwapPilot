# landio (copy)

This repo was exported from the Framer project "landio (copy)"

This is just an example showcasing how to import the components and render them for your project. You will need to tweak a few styles and code to make the website look the same as Framer, for example changing the background color. You will also need to add other pages manually, following [App.tsx](./src/App.tsx) as an example.

## Preview of your website

An example preview of your website is already deployed [here](https://landio-copy-087b2-demos.unframer.co). If there are any styles issues like wrong background color you can easily fix it with a little bit of code. When you push new commits to this repository that website will be automatically updated.

## Customizing styles and content

The important code is inside [App.tsx](./src/App.tsx), it imports the Framer styles and your project React components. You can customize them using Tailwind classes and passing props, each Framer variable becomes a customizable React prop.

To customize content you can also change the content directly in Framer and sync again. CMS content will need to run `npm run framer` to be synced with your code too.

## Sync changes from Framer

After you make changes inside the Framer project you can run again the command `npm run framer` to download the latest changes from your Framer project. If you add new components or pages you will also need to run the React Export plugin again first.

## Development

Install dependencies:
```bash
npm install
```

Generate component files from Framer:
```bash
npm run framer
```

Start development server:
```bash
npm run dev
```

## Project Structure

The `package.json` `framer` script generates the React components in the `src/framer` folder. These files are machine generated and should not be updated manually, instead you can update the content directly in Framer and sync again. You can also use Framer variables to update content from code using React props. This works even for callbacks like `onClick`.

The file [App.tsx](./src/App.tsx) contains an example generated component with your components, you can modify it to change the appearence of your website. You can also pass Framer variables using props.


## More info

You can read more documentation in [the Unframer repository](https://github.com/remorses/unframer)
