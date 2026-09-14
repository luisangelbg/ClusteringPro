use strict; use warnings;
my @files = sort glob('data/*.csv');
open my $o, '>:raw', 'js/examples.js' or die;
print $o "/* ClusteringPro - the example data sets of data/, embedded so that they also load when index.html\n   is opened with a double click (browsers do not let a local page read other files). Generated from\n   data/*.csv with manual/herramientas/incrustar-ejemplos.pl; keep both in sync. */\nwindow.EXAMPLE_DATA = {\n";
my $bs = chr(92); my $dq = chr(34);
for my $f (@files) {
  open my $i, '<:raw', $f or die; local $/; my $t = <$i>; close $i;
  $t =~ s/^\xEF\xBB\xBF//; $t =~ s/\r\n/\n/g;
  $t =~ s/\Q$bs\E/$bs$bs/g; $t =~ s/\Q$dq\E/$bs$dq/g; $t =~ s/\n/${bs}n/g;
  print $o "  $dq$f$dq: $dq$t$dq,\n";
}
print $o "};\n";
close $o;
print scalar(@files), " files\n";
