# Manual de usuario de ClusteringPro

El manual se escribe por partes, en HTML, con la misma dinámica que los manuales de PCAPro y PopGeneticsPro. Primero se hace en español; después, si se decide, en inglés. Cuando esté completo, las partes se unen en un solo documento y se imprime a PDF.

```
manual/
  manual.css           hoja común: tamaño carta y marco de la portada
  interior.css         estilo de las páginas interiores (se añade con la parte 2)
  paginar.js           reparte el contenido en hojas tamaño carta (encabezados, números de página, índice)
  img/                 capturas de pantalla de la app
  herramientas/
    captura.html       abre la app, ejecuta una receta de pasos y deja la vista lista para la captura
    unir-manual.pl     une portada y partes en es/manual-completo.html para imprimir el manual completo
  es/
    00-portada.html    portada blanca: título en español e inglés; un dendrograma cortado en cuatro grupos cuyas
                       hojas son una orquídea, un tulipán, una flor de loto, una rama de café, una libélula,
                       un chapulín, un mayate, una mariposa cola de golondrina y una araña saltarina; debajo,
                       un mapa de k-means con elipses, un gráfico de silueta y un dendrograma circular
                       (todo dibujado con gráficos vectoriales originales, sin imágenes de terceros)
  en/                  versión en inglés (pendiente)
```

## Ver una parte

Abre el HTML con doble clic, o con el servidor local de la app (`server.ps1`, puerto 8900) en `http://localhost:8900/manual/es/00-portada.html`. Sin conexión a internet el navegador usa tipografías del sistema en lugar de Cormorant y Jost.

## Colores por capítulo

Las franjas de la portada y las pestañas de las hojas interiores usan un color por capítulo:

| Capítulo | Color | Variable |
|---|---|---|
| Preliminares y capítulo 1 | azul marino `#14213d` | `--b0` |
| 1 Inicio y teoría | índigo `#4f46a5` | `--b1` |
| 2 Datos y exploración | verde azulado `#0f766e` | `--b2` |
| 3 Similitud y distancia | azul `#2b7bb9` | `--b3` |
| 4 Agrupamiento jerárquico | púrpura `#7e3fb0` | `--b4` |
| 5 Particionamiento y métodos avanzados | naranja tostado `#d9701f` | `--b5` |
| 6 Número de grupos y validación | carmín `#b4234a` | `--b6` |
| 7 Perfiles y predicción | verde hoja `#3f7d20` | `--b7` |
| 8 Informe y exportación | grafito `#334155` | `--b8` |
| Apéndices | negro `#111111` | `--bx` |

## Cómo obtener el PDF de la portada

Con el servidor local en marcha:

```
msedge --headless=new --no-pdf-header-footer --virtual-time-budget=20000 --print-to-pdf=C:\ruta\sin\espacios\portada.pdf "http://localhost:8900/manual/es/00-portada.html"
```

Desde el cuadro de impresión del navegador: destino **Guardar como PDF**, márgenes **Ninguno** y **Gráficos de fondo** activado.

## Componentes de terceros

- **Cormorant**, de Christian Thalmann. Licencia SIL Open Font License 1.1.
- **Jost**, de Owen Earl. Licencia SIL Open Font License 1.1.

Ambas se cargan desde el servicio público de fuentes web. Todo lo demás es original: ilustraciones, diagramas, el paginador y la herramienta de capturas.
