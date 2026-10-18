# Life Choices

A small static web experience. Click an accessory on the start screen, walk ten moments of a real person's life, and see where your choices matched theirs.

Plain HTML, CSS and JavaScript. No framework, no build step, no npm.

```
index.html      page shell
styles.css      all styles, including the jelly motion
app.js          screens and branching logic
stories.js      all story text (four paths: rowling, kusama, frida, montessori)
prototype.html  the original prototype, kept for reference (not used by the site)
assets/
  accessories/glasses.png    -> J.K. Rowling
  accessories/dothat.png     -> Yayoi Kusama
  accessories/flowers.png    -> Frida Kahlo
  accessories/bow.png        -> Maria Montessori
  backgrounds/rowling.png, kusama.png, frida.png, montessori.png
```

## Run it locally

Double-click `index.html`. It works straight from the file system.

If you prefer a local server (closer to how it behaves online):

```bash
python3 -m http.server 8000
```

then open http://localhost:8000.

## Replace an image

Save the new file with the **same name** in the same folder under `assets/`, overwriting the old one. Reload the page.

- Accessories should be PNGs with a **transparent** background and no shadow. (The current ones were cut out from the white-background originals in the `  accessories/` folder.)
- Backgrounds are shown with `background-size: cover` anchored to the bottom, so keep the important shape near the bottom centre and the top two thirds quiet.
- If a file is missing, the site does not break: accessories fall back to the simple drawings from the prototype, and backgrounds fall back to a matching colour gradient.
- Large images slow the page down. About 1920px wide is plenty for backgrounds, and about 500px for accessories.

## Add a new path

1. In `stories.js`, add a new key next to the other four, copying the shape of an existing one:

   ```js
   newkey: {
     name: "Person's name", title: "Path title", icon: "Accessory name", accessory: "newacc",
     heads: "Heads-up notice shown on every question screen.",
     questions: [ /* exactly 10 of: */
       { scene: "...", q: "...", a: "what the person really did", b: "the other choice",
         dev: { t: "deviation scene", o: [["option text", 3], ["option text", "E:Ending: ..."]] } }
     ],
     reveal: { facts: ["..."], psych: "...", closing: "..." }
   }
   ```

   A deviation target is either the index of the next main question (0 to 9, or 10 to go to the reveal) or a string starting with `E:` for an ending.

2. Add the accessory image as `assets/accessories/newacc.png` and the background as `assets/backgrounds/newkey.png`.
3. In `app.js`, add `{ id: "newacc", alt: "Accessory name", story: "newkey" }` to `ACCESSORIES`.
4. In `styles.css`, add a background rule `#bg.path-newkey { ... }` (copy an existing one). The new accessory appears automatically in the row between "Life" and "Choices"; the row is sized for four, so with five or more you may want to lower the `font-size` on `.title`.

## After changing a file

`index.html` loads `styles.css`, `stories.js` and `app.js` with a version tag (`?v=10`), and `app.js` loads the accessory images with `ASSET_VERSION`. Raise these numbers when you change a file so browsers fetch the new copy instead of a cached one.

## Deploy to GitHub Pages

1. Create a new repository on GitHub and upload all the files above (keep the folder structure; `index.html` must be at the top level). The original source folders (`  accessories/`, `background/`) are not needed online.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, pick `main` and `/ (root)`, then **Save**.
4. After a minute the site is live at `https://<your-user>.github.io/<repo-name>/`.

Netlify and Vercel work the same way: drag the folder onto Netlify Drop, or import the repository in Vercel with no build command and the root as the output directory.

## Notes

- Respects "reduce motion" system settings: all animation is turned off.
- These paths are adapted. They are not a diagnosis or a substitute for professional help.
