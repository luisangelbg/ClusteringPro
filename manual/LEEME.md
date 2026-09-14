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
    03-bloque2.html    capítulo 3 · Bloque 2 "Datos y análisis exploratorio": formatos y disposición de la tabla,
                       tipos y papeles de columna con las reglas de detección, faltantes/transformación/escalado,
                       Hopkins y VAT, calificación A–D y ruta recomendada, figuras del bloque y paso a paso con
                       los siete ejemplos (cifras reales de la app)
    04-bloque3.html    capítulo 4 · Bloque 3 "Similitud y distancia": similitud/disimilitud/distancia, las seis
                       familias y los 39 coeficientes con fórmula, métrico y euclidiano (con la casilla √d),
                       diagnóstico de la matriz, comparación de coeficientes, figuras del bloque y seis prácticas
    05-bloque4.html    capítulo 5 · Bloque 4 "Agrupamiento jerárquico": aglomerativo y divisivo, las diez reglas con sus
                       coeficientes de Lance y Williams, cofenética y coeficientes, corte, estudio de dendrogramas,
                       mapa de calor con árboles, comparación de reglas y tanglegramas, seis prácticas
    06-bloque5.html    capítulo 6 · Bloque 5 "Particionamiento y métodos avanzados": k-means y k-means jerárquico,
                       PAM y CLARA, fuzzy c-means, mezclas gaussianas con BIC, DBSCAN y espectral, coordenadas
                       frente a matriz, figuras, comparación a igual k y seis prácticas
    07-bloque6.html    capítulo 7 · Bloque 6 "Número de grupos y validación": trece criterios y su voto,
                       estadístico gap (con k = 1), estabilidad por bootstrap, AU/BP multiescala, validación
                       externa, comparación de algoritmos a lo largo de k y siete prácticas
    08-bloque7.html    capítulo 8 · Bloque 7 "Perfiles, interpretación y predicción": valores de prueba,
                       categorías, especies indicadoras, discriminante, árbol de clasificación, asignación
                       de objetos nuevos y siete prácticas
    09-bloque8.html    capítulo del Bloque 8 (pendiente)
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

Pasos disponibles: `ex:N` (carga el ejemplo N, desde 0; los dos últimos son simulados) · `apply` (aplica el preprocesamiento del Bloque 2) · `step:N` · `run:idBoton` (pulsa y espera a que el botón vuelva a habilitarse) · `click:selector` · `wait:ms` · `scroll:selector[,desfase]` · `open:selector` (abre un `<details>`) · `select:selector=valor` · `set:selector=valor` · `check:selector=true|false` · `cfg:figura.clave=valor` (opción del editor de una figura) · `hide:selector` · `frame:selector` (un iframe crece a la altura de su contenido) · `scrollin:iframe|elemento,desfase` · `top` · `scrollx:selector,px` (desplaza en horizontal una tabla ancha, como la de variables) · `report` (la página se convierte en el informe del Bloque 8, para imprimirlo con `--print-to-pdf`). En la dirección, `#` se escribe `%23`, la coma dentro de un valor `%2C` y los espacios `%20`. La ruta de salida no debe tener espacios. El parámetro `w` de la dirección fija el ancho del marco (1400 por defecto); la app limita su ancho de contenido, así que ensanchar el marco no revela columnas ocultas: para eso está `scrollx`.

Cuidado con Bash: en `"…\\$nombre.png"` la barra escapa al signo de dólar y el archivo se llama literalmente `$nombre.png`; arma la ruta en una variable (`f="$OUT"'\'"$nombre.png"`).

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
| `b2-carga.png` | `step:2;scroll:%23dropZone,110` (ventana 1400 × 780) | 2300 × 1400 desde (250, 30) |
| `b2-mensajes.png` | `ex:0;scroll:%23dataMessages,10` (ventana 1400 × 300) | 2300 × 320 desde (250, 10) |
| `b2-preview.png` | `ex:0;scroll:%23previewCard,10` (ventana 1400 × 420) | 2300 × 800 desde (250, 20) |
| `b2-vartabla.png` | `ex:0;scroll:%23varCard,10` (`w=1700`, ventana 1700 × 1300) | 2320 × 1020 desde (540, 740) |
| `b2-vartabla2.png` | `ex:0;scrollx:%23varTable,900;scroll:%23varTable,10` (ventana 1400 × 760) | 1890 × 1015 desde (600, 20) |
| `b2-resumen.png` | `ex:0;scroll:%23varSummary,70` (ventana 1400 × 640) | 2300 × 1180 desde (250, 60) |
| `b2-prep.png` | `ex:0;scroll:%23prepCard,10` (ventana 1400 × 440) | 2300 × 560 desde (250, 20) |
| `b2-eda.png` | `ex:0;apply;scroll:%23edaCard,10` (ventana 1400 × 1000) | 2300 × 1810 desde (250, 20) |
| `b2-varbox.png` · `b2-corrvat.png` · `b2-pca.png` · `b2-hopkins.png` | `ex:0;apply;scroll:%23figVarBox,10` (560) · `…%23figCorr,10` (720) · `…%23figPCA,10` (760) · `…%23figHopkins,10` (560) | 2200 de ancho desde x 300; alturas 900, 1300, 1500, 960 |
| `b2-binario-vat.png` | `ex:1;apply;scroll:%23figVAT,10` (ventana 1400 × 720) | 1090 × 955 desde (300, 20): solo la tarjeta izquierda |
| `b2-insectos-pca.png` | `ex:2;apply;scroll:%23figPCA,10` (ventana 1400 × 760) | 2200 × 1500 desde (300, 20) |
| `b2-suelos-varbox.png` | `ex:3;apply;scroll:%23figVarBox,10` (ventana 1400 × 640) | 2200 × 1170 desde (300, 20) |
| `b2-matriz-mds.png` | `ex:4;scroll:%23figPCA,10` (ventana 1400 × 760; la matriz se aplica sola) | 2200 × 1500 desde (300, 20) |
| `b2-sim-hopkins.png` · `b2-ruido-hopkins.png` | `ex:5;apply;scroll:%23figHopkins,10` · `ex:6;…` (ventana 1400 × 560) | 1090 × 960 desde (300, 20): solo la tarjeta izquierda |
| `b2-ruido-eda.png` | `ex:6;apply;scroll:%23edaCard,10` (ventana 1400 × 700) | 2300 × 1380 desde (250, 20) |
| `b3-elegir.png` | `ex:0;apply;step:3;scroll:%23distReco,70` (ventana 1400 × 760) | 2300 × 1050 desde (250, 20) |
| `b3-gower.png` | `ex:3;apply;step:3;open:%23pGower%20details;scroll:%23famTabs,60` (ventana 1400 × 820) | 2300 × 1160 desde (250, 110) |
| `b3-resultados.png` · `b3-vecinos.png` | `ex:0;apply;step:3;run:distRunBtn;scroll:%23distResults,10` (860) · `…;open:%23distResults%20details.acc;scroll:%23distResults%20details.acc,10` (560) | 2300 de ancho desde (250, 20); alturas 1200 y 1100 |
| `b3-heat.png` · `b3-mds.png` · `b3-shepard.png` · `b3-knn.png` | `ex:0;apply;step:3;run:distRunBtn;scroll:%23fig3Heat,10` (820) · `…%23fig3MDS,10` (760) · `…%23fig3Shepard,10` (640) · `…%23fig3KNN,10` (760) | 2200 de ancho desde x 300; alturas 1500, 1500, 1260, 1380 |
| `b3-comparar-lista.png` · `b3-comparar-fig.png` | `ex:0;apply;step:3;run:distRunBtn;run:cmpRunBtn;scroll:%23cmpCard,10` (ventana 1400 × 1400), dos recortes de la misma captura | 2300 × 1060 desde (250, 20) · 2200 × 1375 desde (300, 1265) |
| `b3-binario-heat.png` | `ex:1;apply;step:3;run:distRunBtn;scroll:%23fig3Heat,10` (820) | 2200 × 1500 desde (300, 20) |
| `b3-insectos-cmp.png` · `b3-insectos-sqrt.png` | `ex:2;apply;step:3;run:distRunBtn;run:cmpRunBtn;scroll:%23cmpResults,10` (900) · `ex:2;apply;step:3;check:%23distSqrt=true;run:distRunBtn;scroll:%23distResults,10` (700) | 2200 × 1370 desde (300, 190) · 2300 × 1310 desde (250, 20) |
| `b3-suelos-mds.png` · `b3-matriz-res.png` · `b3-ruido-hist.png` | `ex:3;…;scroll:%23fig3MDS,10` (760) · `ex:4;step:3;run:distRunBtn;scroll:%23distResults,10` (700) · `ex:6;…;scroll:%23fig3Shepard,10` (640) | 2200 × 1500 desde (300, 20) · 2300 × 1040 desde (250, 20) · 2200 × 1260 desde (300, 20) |
| `b4-*.png` (20 capturas) | prefijo común `M = ex:N;apply;step:3;run:distRunBtn;step:4` (sin `apply` con la matriz) y luego `run:hcRun` y, según la figura, `run:cmp4Run`, `run:tgRun`, `select:%23hcMethod=average` (o `diana`, `single`), `cfg:fig4Dendro.layout=radial` · `horizontal` · `radialtri`, `cfg:fig4Dendro.collapse=true`, `cfg:fig4Dendro.colourBy=gradient`, `cfg:fig4Dendro.legendPos=bottom`, `open:%23fig4Dendro%20details.fig-editor`; `scroll:` a `%23hcReco`, `%23hcResults`, `%23fig4Heights`, `%23hcResults%20h3`, `%23fig4Dendro`, `%23fig4Heatmap`, `%23cmp4Card`, `%23fig4Methods`, `%23fig4Tangle` (ventanas 1400 × 520–1250) | tarjetas 2300 de ancho desde (250, 20); figuras 2200 de ancho desde (300, 20); alturas entre 700 y 1780 |
| `b5-*.png` (21 capturas) | prefijo `ex:N;apply;step:3;run:distRunBtn;step:4;[select:%23hcMethod=average;]run:hcRun;step:5` y luego `select:%23ptMethod=kmeans|pam|fcm|gmm|dbscan`, `select:%23ptSource=pcoa`, `set:%23dbMinPts=3|6`, `run:ptRun`, `run:cmp5Run`; `scroll:` a `%23ptReco,70`, `%23ptResults`, `%23fig5Map`, `%23fig5Sil`, `%23fig5Extra`, `%23fig5Bic`, `%23cmp5Card`, `%23cmp5Results` (ventanas 1400 × 560–1250) | tarjetas 2300 de ancho desde (250, 0–20); mapas 2200 × 1310 desde (300, 20); siluetas solo la tarjeta izquierda, 1086 de ancho desde (300, 20) |
| `b6-*.png` (20 capturas) | prefijo `P = ex:N;apply;step:3;run:distRunBtn;step:4;[select:%23hcMethod=average;]run:hcRun;step:5;run:ptRun;step:6` (sin `apply` con la matriz; UPGMA en los ejemplos 1 y 2) y luego `run:vkRun`, `run:stRun`, `run:pvRun`, `run:exRun`, `run:cvRun`; `scroll:` a `%23panel-6,10`, `%23vkTiles,60`, `%23fig6Panel`, `%23fig6Votes`, `%23fig6Elbow`, `%23fig6Gap`, `%23stSource,60`, `%23pvCard`, `%23fig6Pv`, `%23exA,60`, `%23cvList,60`, `%23fig6Cv` (ventanas 1400 × 560–1200; tres grupos de capturas en paralelo con perfiles `--user-data-dir` distintos) | tarjetas y tablas 2200 de ancho desde (300, 110–300); paneles 2140 × 1180 desde (330, 120); votos 1600 × 830 desde (560, 120); gap 1300 × 780 desde (740, 120); codo y silueta 2110 × 630 desde (330, 120) |
| `b7-*.png` (19 capturas) | prefijo `ex:N;apply;step:3;run:distRunBtn;step:4;[select:%23hcMethod=average;]run:hcRun;step:5;run:ptRun;step:6;run:vkRun;step:7` (suelos con `click:%23adoptK;wait:1500;step:5;run:ptRun` antes de `step:7`) y luego `run:prRun`, `click:%23predExample;click:%23predictBtn`; `scroll:` a `%23prSource,110`, `%23prTiles,60`, `%23prQuantTable`, `%23fig7Heat`, `%23fig7Radar`, `%23fig7Boxes`, `%23prIndTable`, `%23fig7Indval`, `%23fig7Cats`, `%23ldaCard`, `%23fig7LDA`, `%23treeRules,70`, `%23predCard` (ventanas 1400 × 560–1100) | tarjetas y tablas 2200 de ancho desde (300, 20–310); radar y coordenadas paralelas son dos recortes de 1040 de ancho desde x = 330 y x = 1430 |

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
