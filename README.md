# Volvimos al cyber

Dos extensiones gratuitas de Chrome creadas por Alan Daitch:

- **Fotolog para Instagram 2.3.0**: inicio con filtros de fotos y reels; perfiles como diarios de tres columnas; reproducción de reels, paletas por usuario, favoritos y perfiles recientes.
- **Taringa! para Reddit 2.1.0**: cabecera azul, índice clásico de posts, categorías por comunidad, destacados y publicaciones originales dentro del skin.

[Descargas e instalación](https://alandaitch.github.io/nostalgia-extensions/) · [Última versión](https://github.com/alandaitch/nostalgia-extensions/releases/latest) · [Privacidad](https://alandaitch.github.io/nostalgia-extensions/privacy.html) · [Reportar un error](https://github.com/alandaitch/nostalgia-extensions/issues)

## Instalar desde ZIP

1. Descargá el ZIP de la extensión desde Releases y descomprimilo en una carpeta que vayas a conservar.
2. Abrí `chrome://extensions` y activá **Modo de desarrollador**.
3. Elegí **Cargar descomprimida** y seleccioná la carpeta que contiene `manifest.json`.
4. Abrí o recargá Instagram o Reddit.

También podés descargar este repositorio y seleccionar directamente `instagram-fotolog/` o `reddit-taringa/`.

**Chrome Web Store:** ambas extensiones se enviaron a revisión el 15 de octubre de 2026, con publicación automática después de la aprobación. Aún no están disponibles en la tienda; mientras tanto, la descarga requiere los pasos anteriores.

## Uso

El botón de cada extensión permite cambiar los colores y activar o desactivar el skin. Fotolog tiene paletas por usuario y un selector Colores dentro del diario. Al seleccionar un reel se reproduce sin sonido; podés activar el audio desde el reproductor. Su inicio muestra el feed y los perfiles muestran el diario. Taringa permite listas compactas o títulos amplios.

Las extensiones usan las publicaciones que los sitios ya cargaron; no evitan el inicio de sesión ni otras restricciones. Las operaciones como comentar, votar o guardar siguen perteneciendo al sitio original. Algunas pantallas conservan su interfaz habitual. Los cambios de Instagram y Reddit pueden requerir actualizaciones.

## Privacidad y permisos

Sólo solicitan `storage` y acceso a las páginas de su propio sitio. No tienen servidores propios ni analíticas. Fotolog guarda preferencias y favoritos localmente, y hasta 12 nombres de perfiles recientes en la sesión. Taringa guarda preferencias de diseño. Los contenidos se procesan localmente y los medios conservan sus proveedores originales. Consultá la política completa antes de instalarlas.

## Crear los ZIP

Con Node.js y Python 3 instalados:

```sh
node build.mjs
```

El build valida sintaxis y recursos, copia el runtime y popup compartidos y genera dos ZIP independientes en `dist/`, con `manifest.json` en la raíz. No necesita dependencias de npm.

Son recreaciones independientes sin afiliación con Instagram, Meta, Fotolog, Reddit ni Taringa. Las marcas pertenecen a sus respectivos titulares.
