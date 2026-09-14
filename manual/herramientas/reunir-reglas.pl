#!/usr/bin/perl
# ClusteringPro · manual de usuario: reúne las reglas de decisión de los capítulos en el apéndice B.
# Uso, desde la carpeta manual/:   perl herramientas/reunir-reglas.pl es
# Lee los recuadros "caja regla" de 01-introduccion.html a 09-bloque8.html, les añade la sección
# de donde vienen y reescribe el índice y los recuadros entre las marcas "reglas: inicio" y
# "reglas: fin" de 10-apendices.html. El recuadro de muestra de "Cómo leer este manual" no cuenta.
use strict; use warnings; use utf8;
use open qw(:std :encoding(UTF-8));

my $dir = shift or die "uso: perl herramientas/reunir-reglas.pl <carpeta del idioma>\n";
my @caps = (
  ['01-introduccion.html', 'k0', '1',  'Introducción a ClusteringPro'],
  ['02-bloque1.html',      'k1', 'B1', 'Inicio y teoría'],
  ['03-bloque2.html',      'k2', 'B2', 'Datos y análisis exploratorio'],
  ['04-bloque3.html',      'k3', 'B3', 'Similitud y distancia'],
  ['05-bloque4.html',      'k4', 'B4', 'Agrupamiento jerárquico'],
  ['06-bloque5.html',      'k5', 'B5', 'Particionamiento y métodos avanzados'],
  ['07-bloque6.html',      'k6', 'B6', 'Número de grupos y validación'],
  ['08-bloque7.html',      'k7', 'B7', 'Perfiles, interpretación y predicción'],
  ['09-bloque8.html',      'k8', 'B8', 'Informe y exportación'],
);
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
    $box =~ s{(<div class="caja-t"><span class="ico">✓</span>.*?)</div>}{$1<span class="sec-ref">@{[ $snum =~ /\./ ? "Sección $snum" : "Capítulo $snum" ]}</span></div>}s;
    $box =~ s/\n    /\n  /g;
    $cuerpo .= "\n  $box\n";
    (my $corto = $tit) =~ s/^Reglas? (?:de decisión )?· //;
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
