# Installe un dossier de photos dans la galerie, en DEUX tailles.
#
# POURQUOI DEUX TAILLES
# Les fichiers du photographe font ici pres de 3000 px et 7 a 9 Mo piece.
# Une seule taille ne peut pas servir les deux usages :
#   - la grille affiche neuf photos grandes comme un timbre. En pleine
#     resolution, elle ferait attendre une minute sur un telephone.
#   - l'agrandissement, lui, occupe tout l'ecran : c'est la, et seulement la,
#     que la finesse se voit.
# On produit donc une vignette legere pour la grille, et une version haute
# definition pour l'agrandissement — chargee une seule a la fois, au moment
# ou on la regarde.
#
# Le script n'utilise que System.Drawing, livre avec Windows : rien a
# installer. Les originaux ne sont JAMAIS modifies.
#
#   powershell -File scripts/preparer-photos.ps1 -Source "C:\...\photos"
#   powershell -File scripts/preparer-photos.ps1 -Source "..." -Noms poke,nigiri,...
#
# L'ordre d'affichage est celui des fichiers sources, tries par nom.

param(
  [Parameter(Mandatory = $true)][string]$Source,
  [string[]]$Noms = @(),
  # 2800 px : au-dela, meme un ecran Retina n'y gagne plus rien de visible.
  [int]$CoteHD = 2800,
  [int]$QualiteHD = 93,
  # 1600 px : de quoi rester net dans une tuile sur un ecran a 3x.
  [int]$CoteVignette = 1600,
  [int]$QualiteVignette = 82
)

# Lance via `powershell -File`, un parametre tableau arrive comme UNE chaine
# « a,b,c ». On redecoupe donc systematiquement : le script marche aussi bien
# appele depuis un terminal que depuis un autre script.
$Noms = @($Noms) -join ',' -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ }

Add-Type -AssemblyName System.Drawing

$racine = Split-Path -Parent $PSScriptRoot
$galerie = Join-Path $racine 'public\galerie'
$vignettes = Join-Path $galerie 'vignettes'

foreach ($d in @($galerie, $vignettes)) {
  if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null }
}

$encodeur = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
            Where-Object { $_.MimeType -eq 'image/jpeg' }

function Convertir {
  param([System.Drawing.Image]$Source, [string]$Sortie, [int]$CoteMax, [int]$Qualite)

  # Un seul facteur pour les deux cotes : les proportions sont conservees.
  # Jamais superieur a 1 : on n'agrandit pas une photo, cela ne cree rien.
  $facteur = [Math]::Min(1.0, $CoteMax / [Math]::Max($Source.Width, $Source.Height))
  $largeur = [int][Math]::Round($Source.Width * $facteur)
  $hauteur = [int][Math]::Round($Source.Height * $facteur)

  $params = New-Object System.Drawing.Imaging.EncoderParameters 1
  $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
    [System.Drawing.Imaging.Encoder]::Quality, [long]$Qualite)

  $cible = New-Object System.Drawing.Bitmap($largeur, $hauteur)
  try {
    $g = [System.Drawing.Graphics]::FromImage($cible)
    try {
      $g.InterpolationMode = 'HighQualityBicubic'
      $g.SmoothingMode = 'HighQuality'
      $g.PixelOffsetMode = 'HighQuality'
      $g.CompositingQuality = 'HighQuality'

      # Les PNG portent un canal alpha, pas le JPEG. Sans ce fond blanc, tout
      # ce qui est transparent ressortirait en NOIR autour de l'assiette.
      $g.Clear([System.Drawing.Color]::White)
      $g.DrawImage($Source, 0, 0, $largeur, $hauteur)
    } finally { $g.Dispose() }

    $cible.Save($Sortie, $encodeur, $params)
  } finally { $cible.Dispose() }

  return "$largeur x $hauteur"
}

function Assainir {
  param([string]$Texte)
  $t = $Texte.ToLower() -replace '[àâä]', 'a' -replace '[éèêë]', 'e' `
       -replace '[îï]', 'i' -replace '[ôö]', 'o' -replace '[ûùü]', 'u' -replace 'ç', 'c'
  $t = $t -replace '[^a-z0-9]+', '-' -replace '^-|-$', ''
  if ($t) { return $t } else { return 'photo' }
}

$fichiers = Get-ChildItem -Path $Source -File |
            Where-Object { $_.Extension -match '^\.(png|jpg|jpeg)$' } |
            Sort-Object Name

if ($fichiers.Count -eq 0) { Write-Error "Aucune image dans $Source"; exit 1 }

# Les anciennes photos et vignettes s'en vont : on reconstruit tout.
Get-ChildItem $galerie -File | Remove-Item -Force
Get-ChildItem $vignettes -File -ErrorAction SilentlyContinue | Remove-Item -Force

$poidsHD = 0
$poidsVig = 0
$i = 0

foreach ($f in $fichiers) {
  $i++
  $rang = '{0:D2}' -f $i
  $etiquette = if ($Noms.Count -ge $i) { Assainir $Noms[$i - 1] } else { Assainir $f.BaseName }
  $nom = "$rang-$etiquette.jpg"

  $img = [System.Drawing.Image]::FromFile($f.FullName)
  try {
    $tailleHD = Convertir -Source $img -Sortie (Join-Path $galerie $nom) `
                          -CoteMax $CoteHD -Qualite $QualiteHD
    Convertir -Source $img -Sortie (Join-Path $vignettes $nom) `
              -CoteMax $CoteVignette -Qualite $QualiteVignette | Out-Null
  } finally { $img.Dispose() }

  $hd = (Get-Item (Join-Path $galerie $nom)).Length
  $vig = (Get-Item (Join-Path $vignettes $nom)).Length
  $poidsHD += $hd
  $poidsVig += $vig

  "{0,-26} -> {1,-26} {2,11}   HD {3,5} Ko   vignette {4,4} Ko" -f `
    $f.Name, $nom, $tailleHD, [int]($hd / 1KB), [int]($vig / 1KB)
}

""
"{0} photo(s) installee(s)." -f $fichiers.Count
"  grille (chargee d'un coup)  : {0} Ko" -f [int]($poidsVig / 1KB)
"  pleine resolution (a l'unite) : {0} Mo" -f [Math]::Round($poidsHD / 1MB, 1)
"Rafraichissez la page : aucun redemarrage necessaire."
