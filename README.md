# ASCII Art Playground

Un editor/playground para crear arte ASCII en el navegador: dibuja con el mouse, escribe con el teclado, posiciona caracteres en una grilla y exporta tu creación como texto o como imagen PNG.

No requiere build ni dependencias — es HTML/CSS/JS puro.

## Uso

Abre `index.html` directamente en tu navegador, o sirve la carpeta con cualquier servidor estático:

```bash
npx serve .
```

## Funcionalidad

- **Grilla configurable**: define columnas y filas del lienzo.
- **Modo Escribir**: haz clic en una celda y escribe con el teclado; el cursor avanza automáticamente (flechas para moverte, Enter para saltar de línea, Backspace/Delete para borrar).
- **Modo Pintar**: elige un carácter (de la paleta o escribiéndolo) y arrastra el mouse sobre el lienzo para "pintarlo".
- **Modo Borrar**: arrastra para limpiar celdas.
- **Apariencia**: tamaño de fuente, color de texto y color de fondo, con opción de fondo transparente para el PNG.
- **Deshacer / Rehacer** (Ctrl+Z / Ctrl+Shift+Z).
- **Exportar**:
  - Copiar como texto al portapapeles.
  - Descargar como `.txt`.
  - Descargar como `.png`.

## Estructura

- `index.html` — estructura de la página.
- `style.css` — estilos.
- `app.js` — lógica del editor (estado de la grilla, interacción, exportación).
