#!/usr/bin/perl
# ClusteringPro · manual de usuario: reúne las reglas de decisión de los capítulos en el apéndice B.
# Uso, desde la carpeta manual/:   perl herramientas/reunir-reglas.pl es
# Lee los recuadros "caja regla" de 01-introduccion.html a 09-bloque8.html, les añade la sección
# de donde vienen y reescribe el índice y los recuadros entre las marcas "reglas: inicio" y
# "reglas: fin" de 10-apendices.html. El recuadro de muestra de "Cómo leer este manual" no cuenta.
use strict; use warnings; use utf8;
use open qw(:std :encoding(UTF-8));

my $dir = shift or die "uso: perl herramientas/reunir-reglas.pl <carpeta del idioma>\n";
# los nombres de los capítulos y las palabras del índice siguen al idioma de la carpeta
my %L = (
  es => { sec => 'Sección', cap => 'Capítulo', quita => qr/^Reglas? (?:de decisión )?· /,
          caps => ['Introducción a ClusteringPro', 'Inicio y teoría', 'Datos y análisis exploratorio',
                   'Similitud y distancia', 'Agrupamiento jerárquico', 'Particionamiento y métodos avanzados',
                   'Número de grupos y validación', 'Perfiles, interpretación y predicción', 'Informe y exportación'] },
  en => { sec => 'Section', cap => 'Chapter', quita => qr/^(?:Decision )?[Rr]ules? · /,
          caps => ['Introduction to ClusteringPro', 'Home and theory', 'Data and exploratory analysis',
                   'Similarity and distance', 'Hierarchical clustering', 'Partitioning and advanced methods',
                   'Number of clusters and validation', 'Profiles, interpretation and prediction', 'Report and export'] },
);
my $L = $L{$dir} or die "no sé los rótulos del idioma «$dir»\n";
my @archivos = qw(01-introduccion.html 02-bloque1.html 03-bloque2.html 04-bloque3.html 05-bloque4.html
                  06-bloque5.html 07-bloque6.html 08-bloque7.html 09-bloque8.html);
my @caps = map { [$archivos[$_], 'k' . $_, $_ ? 'B' . $_ : '1', $L->{caps}[$_]] } 0 .. $#archivos;
my @indice;
my $cuerpo = '';
my $n = 0;
for my $c (@caps) {
  my ($file, $k, $chip, $name) = @$c;
  open my $fh, '<', "$dir/$file" or die "$file: $!"; local $/; my $t = <$fh>; close $fh;
  my $pos = index($t, '<section class="capitulo"');
  my @reglas;
  while ((my $b = index($t, '<div class="caja regla"', $pos)) >= 0) {
    my ($depth, $end) = (0, undef);
    pos($t) = $b;
    while ($t =~ /(<div\b|<\/div>)/g) { $depth += ($1 eq '</div>') ? -1 : 1; if ($depth == 0) { $end = pos($t); last; } }
    die "recuadro sin cerrar en $file\n" unless defined $end;
    my $box = substr($t, $b, $end - $b);
    my $snum = '';
    my $before = substr($t, 0, $b);
    while ($before =~ /<h2 id="s\d+-\d+"><span class="num">([\d.]+)<\/span>/g) { $snum = $1; }
    $pos = $end;
    # a rule placed before the first section of a chapter belongs to the chapter as a whole
    if ($snum eq '' && $t =~ /<h2 id="s(\d+)-\d+">/) { $snum = $1; }
    my ($tit) = $box =~ /<div class="caja-t"><span class="ico">✓<\/span>(.*?)<\/div>/s;
    push @reglas, [$snum, $tit, $box];
  }
  next unless @reglas;
  $cuerpo .= qq{\n  <h3 class="ap-cap"><span class="chip $k">$chip</span>$name</h3>\n};
  my @items;
  for my $r (@reglas) {
    my ($snum, $tit, $box) = @$r;
    $n++;
    $box =~ s/^<div class="caja regla"[^>]*>/<div class="caja regla">/;
    $box =~ s{(<div class="caja-t"><span class="ico">✓</span>.*?)</div>}{$1<span class="sec-ref">@{[ $snum =~ /\./ ? "$L->{sec} $snum" : "$L->{cap} $snum" ]}</span></div>}s;
    $box =~ s/\n    /\n  /g;
    $cuerpo .= "\n  $box\n";
    (my $corto = $tit) =~ s/$L->{quita}//;
    $corto =~ s/<[^>]+>//g;
    $corto = ucfirst $corto;
    $corto =~ s/^¿(\p{Ll})/'¿' . uc $1/e;
    push @items, qq{<li><b>$snum</b>$corto</li>};
  }
  push @indice, qq{    <li class="grupo"><span class="chip $k">$chip</span>$name</li>\n} . join('', map { "    $_\n" } @items);
}
my $bloque = qq{  <ul class="indice-reglas">\n} . join('', @indice) . qq{  </ul>\n} . $cuerpo;

my $ap = "$dir/10-apendices.html";
open my $fh, '<', $ap or die "$ap: $!"; my $html = do { local $/; <$fh> }; close $fh;
my $ini = index($html, '<!-- reglas: inicio');
my $fin = index($html, '<!-- reglas: fin -->');
die "no encuentro las marcas de las reglas en $ap\n" if $ini < 0 || $fin < $ini;
my $tras = index($html, "\n", $ini) + 1;
substr($html, $tras, $fin - $tras) = $bloque;
open my $oh, '>', $ap or die; print $oh $html; close $oh;
print "$n reglas escritas en $ap\n";
