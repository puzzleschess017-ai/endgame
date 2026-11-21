# Futura Font Files

Drop your licensed Futura webfont files into this directory (`public/fonts/`), for example:

- `Futura-Regular.woff2` (weight 400)
- `Futura-Medium.woff2` (weight 500)
- `Futura-Bold.woff2` (weight 700)

The server endpoint `/fonts/futura.css` automatically detects `.woff2`, `.woff`, `.ttf`, and `.otf` files in this folder and registers `@font-face` rules for `font-family: "Futura"`.
