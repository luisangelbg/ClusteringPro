# Manual de usuario de ClusteringPro

El manual se escribe por partes, en HTML, con la misma dinámica que los manuales de PCAPro y PopGeneticsPro. Primero se hace en español; después, si se decide, en inglés. Cuando estén todas las partes, se unen en un solo documento y se imprime a PDF (no se generan PDF intermedios por parte).

```
manual/
  manual.css           hoja común: tamaño carta y marco de la portada
  interior.css         estilo de las páginas interiores (encabezados, cajas, tablas, figuras, colores por capítulo)
  paginar.js           reparte el contenido en hojas tamaño carta (encabezados, números de página, índice)
  img/                 capturas de pantalla de la app, a 2× (véase "Capturas de la app")
  herramientas/
    captura.html       abre la app en un marco, ejecuta una receta de pasos y deja la vista lista para la captura
    unir-manual.pl     une portada y partes en es/manual-completo.html para imprimir el manual completo
  es/
    00-portada.html    portada blanca: título en español e inglés; un dendrograma cortado en cuatro grupos cuyas
                       hojas son una orquídea, un tulipán, una flor de loto, una rama de café, una libélula,
                       un chapulín, un mayate, una mariposa cola de golondrina y una araña saltarina; debajo,
                       un mapa de k-means con elipses, un gráfico de silueta y un dendrograma circular
                       (todo dibujado con gráficos vectoriales originales, sin imágenes de terceros)
    01-introduccion.html
                       preliminares (créditos y cómo citar, índice general, cómo leer este manual) y
                       capítulo 1 "Introducción a ClusteringPro" (qué es, para quién, cinco ideas clave,
                       tipos de datos, requisitos, recorrido por la interfaz, ejemplos, flujo de trabajo y
                       cómo leer los números principales)
    02-bloque1.html    capítulo 2 · Bloque 1 "Inicio y teoría": la portada de la app, el demo interactivo con
                       cinco prácticas (cifras reproducibles: semilla fija), tipos de datos y galería de métodos,
                       las trece lecciones de teoría con sus reglas en español, la tabla de elección y cómo citar
    03-bloque2.html … 09-bloque8.html   un capítulo por bloque de la app (pendientes)
    10-apendices.html  apéndices A–F (pendiente)
  en/                  versión en inglés (pendiente)
```

## Ver una parte

Abre el HTML con doble clic, o con el servidor local de la app (`server.ps1`, puerto 8900) en `http://localhost:8900/manual/es/01-introduccion.html`. Sin conexión a internet el navegador usa tipografías del sistema en lugar de Cormorant, Crimson Pro y Jost.

Cada parte interior carga `interior.css` y `paginar.js`. El paginador reparte las secciones en hojas carta, numera con romanos las secciones `class="preliminares"` y con arábigos los `class="capitulo"`, pone la pestaña lateral con el número de capítulo (`data-pestana`) y rellena los números de página del índice (`.toc a.pag`). Cuando una figura no cabe al pie de una hoja, el paginador adelanta hasta tres bloques de texto siguientes para no dejar el hueco; si a una figura le sigue otra figura, el hueco queda, así que conviene colocar un párrafo o una tabla entre dos figuras grandes.

## Convenciones de escritura

- Un archivo por parte; ids `cap-bN` para el capítulo, `sN-M` para las secciones (`s1-6` = sección 1.6) y `ap-x` para los apéndices; `data-nueva-hoja` fuerza salto de hoja.
- Cajas: `caja nota`, `caja importante`, `caja teoria`, `caja ejemplo`, `caja regla`, `caja dato`; pasos numerados con `ol.pasos`; nombres de la interfaz con `span.ui` (siempre en inglés, como aparecen en la app) y rutas con `span.ruta`; fichas de color de grupo con `chip kN`.
- Figuras: `figure` con `img` y `figcaption`; las capturas llevan `class="marco"` y, si hace falta, marcas numeradas `.marca` con su `ul.leyenda-marcas`; `figure.media` ocupa el 84 % del ancho; `.dos` coloca dos figuras lado a lado.
- Los ejemplos que se citan en el texto son los que trae la app; los números (Hopkins, cofenética, silueta, ARI…) se copian de la app tal cual, para que el lector pueda reproducirlos.
- "et al." se escribe "y colaboradores"; sin citas bibliográficas dentro del texto de la app, pero el manual sí puede citar el DOI del programa.

## Colores por capítulo

Las franjas de la portada y las pestañas de las hojas interiores usan un color por capítulo:

| Capítulo | Color | Variable |
|---|---|---|
| Preliminares y capítulo 1 | azul marino `#14213d` | `--b0` |
| 2 Inicio y teoría (Bloque 1) | índigo `#4f46a5` | `--b1` |
| 3 Datos y exploración (Bloque 2) | verde azulado `#0f766e` | `--b2` |
| 4 Similitud y distancia (Bloque 3) | azul `#2b7bb9` | `--b3` |
| 5 Agrupamiento jerárquico (Bloque 4) | púrpura `#7e3fb0` | `--b4` |
| 6 Particionamiento y métodos avanzados (Bloque 5) | naranja tostado `#d9701f` | `--b5` |
| 7 Número de grupos y validación (Bloque 6) | carmín `#b4234a` | `--b6` |
| 8 Perfiles y predicción (Bloque 7) | verde hoja `#3f7d20` | `--b7` |
| 9 Informe y exportación (Bloque 8) | grafito `#334155` | `--b8` |
| Apéndices | negro `#111111` | `--bx` |

Cada capítulo declara su acento con `style="--acento: var(--bN)"`.

## Capturas de la app

`herramientas/captura.html` abre `index.html` en un marco de 1400 × 860 px y ejecuta la receta que recibe en el parámetro `do`, separada por punto y coma. Con el servidor local en marcha:

```
msedge --headless=new --hide-scrollbars --window-size=1400,860 --force-device-scale-factor=2 --virtual-time-budget=30000 --screenshot=C:\ruta\sin\espacios\salida.png "http://localhost:8900/manual/herramientas/captura.html?w=1400&h=860&do=ex:0;apply;step:3;run:distRunBtn;scroll:%23fig3Heat"
```

Pasos disponibles: `ex:N` (carga el ejemplo N, desde 0; los dos últimos son simulados) · `apply` (aplica el preprocesamiento del Bloque 2) · `step:N` · `run:idBoton` (pulsa y espera a que el botón vuelva a habilitarse) · `click:selector` · `wait:ms` · `scroll:selector[,desfase]` · `open:selector` (abre un `<details>`) · `select:selector=valor` · `set:selector=valor` · `check:selector=true|false` · `cfg:figura.clave=valor` (opción del editor de una figura) · `hide:selector` · `frame:selector` (un iframe crece a la altura de su contenido) · `scrollin:iframe|elemento,desfase` · `top` · `report` (la página se convierte en el informe del Bloque 8, para imprimirlo con `--print-to-pdf`). En la dirección, `#` se escribe `%23`, la coma dentro de un valor `%2C` y los espacios `%20`. La ruta de salida no debe tener espacios.

Recetas de las capturas actuales (`h` es la altura del marco cuando no es la predeterminada):

| Archivo | Receta | Recorte |
|---|---|---|
| `app-inicio.png` | *(sin pasos)* | ninguno (1400 × 900) |
| `app-bloques.png` | `scroll:%23featureGrid,118` con `h=780` | ninguno |
| `app-datos.png` | `ex:0;apply;scroll:%23edaCard` | 2300 × 1900 desde (250, 30) |
| `app-figura.png` | `ex:0;apply;step:3;run:distRunBtn;open:%23fig3Heat%20details.fig-editor;scroll:%23fig3Heat` | 2200 × 2160 desde (300, 0) |
| `b1-flujo.png` | `scroll:.workflow,130` (ventana 1400 × 290) | 2320 × 470 desde (240, 30) |
| `b1-demo.png` | `scroll:.playground,96;click:%23pgRun;wait:5000` (ventana 1400 × 660) | 2320 × 1135 desde (240, 185) |
| `b1-lunas.png` | `select:%23pgDataset=moons;select:%23pgLinkage=single;set:%23pgK=2;click:%23pgRun;wait:6000;scroll:.pg-grid,8` (ventana 1400 × 478) | 2320 × 956 desde (240, 0) |
| `b1-anillo.png` | igual, con `ring` | igual |
| `b1-alargados.png` | `select:%23pgDataset=elong;click:%23pgRun;wait:8000;scroll:.pg-grid,8` (ventana 1400 × 478) | igual |
| `b1-uniforme.png` | igual, con `uniform` | igual |
| `b1-tipos.png` | `scroll:%23dtypeGrid,130` (ventana 1400 × 680) | 2320 × 1090 desde (240, 30) |
| `b1-metodos.png` | `scroll:%23methodGallery,130` (ventana 1400 × 1200) | 2320 × 1800 desde (240, 30) |
| `b1-teoria.png` | `scroll:%23theory,10` (ventana 1400 × 900) | 2320 × 802 desde (240, 20) |
| `b1-eleccion.png` | `scroll:table.chooser,96` (ventana 1400 × 600) | 2320 × 1075 desde (240, 20) |
| `b1-porque.png` | `scroll:.why-grid,110` (ventana 1400 × 590) | 2320 × 945 desde (240, 130) |
| `b1-cita.png` | `scroll:%23cite,10` (ventana 1400 × 420) | 2320 × 765 desde (240, 20) |

Los recortes se hacen con `System.Drawing` desde PowerShell sobre la captura a 2×. Las cifras del demo que cita el capítulo 2 (cofenética por enlace, iteraciones, SS entre/total, silueta y ARI) se obtuvieron de la propia app con la semilla fija del demo; si el demo cambia, hay que recalcularlas.

Dos trucos de paginación aprendidos con el capítulo 2: una tabla con `rowspan` se rompe cuando el paginador la parte entre hojas (mejor repetir la familia en la primera fila de cada grupo y dejar celdas vacías), y una caja `regla` no lleva relleno interior porque está pensada para una tabla (un párrafo suelto necesita su propio `padding`).

## Cómo revisar una parte o imprimir la portada

Con el servidor local en marcha:

```
msedge --headless=new --no-pdf-header-footer --virtual-time-budget=20000 --print-to-pdf=C:\ruta\sin\espacios\parte.pdf "http://localhost:8900/manual/es/01-introduccion.html"
```

Desde el cuadro de impresión del navegador: destino **Guardar como PDF**, márgenes **Ninguno** y **Gráficos de fondo** activado. Para comprobar la paginación desde la consola del navegador: `document.querySelectorAll('.hoja').length` da el número de hojas, y una hoja desborda cuando el `scrollHeight` de su `.hoja-cuerpo` supera su `clientHeight`.

## Componentes de terceros

- **Cormorant**, de Christian Thalmann. Licencia SIL Open Font License 1.1.
- **Crimson Pro**, de Jacques Le Bailly. Licencia SIL Open Font License 1.1.
- **Jost**, de Owen Earl. Licencia SIL Open Font License 1.1.

Las tres se cargan desde el servicio público de fuentes web. Todo lo demás es original: ilustraciones, diagramas, el paginador y la herramienta de capturas.
