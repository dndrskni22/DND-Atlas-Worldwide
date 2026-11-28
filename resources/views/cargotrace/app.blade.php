<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="csrf-token" content="{{ csrf_token() }}" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 44 44'><polygon points='22,2 38,8 42,22 38,36 22,42 6,36 2,22 6,8' fill='%23072D59'/><circle cx='22' cy='22' r='13' fill='none' stroke='%237DD3FC' stroke-width='1.5' stroke-dasharray='3 2'/><ellipse cx='22' cy='22' rx='13' ry='6' transform='rotate(-28 22 22)' fill='none' stroke='%23FFFFFF' stroke-width='1.6'/><path d='M22 6 L25 19 L38 22 L25 25 L22 38 L19 25 L6 22 L19 19 Z' fill='%2338BDF8'/><circle cx='22' cy='22' r='3' fill='%23FFFFFF'/></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{ $appName ?? 'DND Atlas Worldwide' }} – Global Multimodal Shipment Visibility</title>
    <meta name="description" content="DND Atlas Worldwide (CargoTrace): Laravel 12 + MySQL 8.0 Multimodal Sea, Air, and Road shipment visibility, tracking timeline, deterministic ETA and delay detection, exception management, and OpenStreetMap route analytics." />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
    @vite(['src/index.css', 'src/main.tsx'])
  </head>
  <body class="bg-[#F4F7FB] text-[#243350] antialiased selection:bg-[#DBF2FC] selection:text-[#072D59] min-h-screen">
    <script>
      window.__CARGOTRACE_LARAVEL_BOOT__ = @json([
        'framework' => 'Laravel 12.x (PHP 8.3 + MySQL 8.0)',
        'groupConfig' => $groupConfig ?? null,
        'counts' => $counts ?? null,
      ]);
    </script>
    <div id="root"></div>
  </body>
</html>
