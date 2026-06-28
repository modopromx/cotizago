# 🚀 CotizaGo — Guía de Despliegue en Hostinger

## 1. Instalar dependencias
```bash
npm install
```

## 2. Configurar variables de entorno
El archivo `.env` ya está configurado con tus credenciales de Supabase.
> ⚠️ Nunca subas `.env` a GitHub público.

## 3. Construir para producción
```bash
npm run build
```
Esto genera la carpeta `dist/` con todos los archivos estáticos.

## 4. Subir a Hostinger
1. Ve al File Manager de Hostinger (o usa FTP)
2. Navega a `public_html/` (o la carpeta de tu dominio)
3. **Elimina** el contenido existente
4. **Sube** todo el contenido de la carpeta `dist/`
   - El archivo `index.html` debe quedar en la raíz de `public_html/`
   - El archivo `.htaccess` también debe estar en la raíz

## 5. Configurar .htaccess para SPA
El archivo `public/.htaccess` se copia automáticamente al `dist/` durante el build.
Si no, créalo manualmente en `public_html/.htaccess`:
```
Options -MultiViews
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.html [QSA,L]
```

---

## 🔄 Proceso de actualización segura (Git workflow)

```bash
# 1. Trabaja siempre en rama dev
git checkout dev

# 2. Haz tus cambios y commits
git add .
git commit -m "feat: nueva función X"

# 3. Sube a GitHub para respaldo
git push origin dev

# 4. Cuando esté listo, merge a main
git checkout main
git merge dev

# 5. Build de producción
npm run build

# 6. Sube SOLO el contenido de dist/ a Hostinger
```

> ✅ La base de datos en Supabase NUNCA se toca durante un deploy de frontend.
> Los datos de tus clientes están seguros siempre.

---

## 🗄️ Migraciones de base de datos
Si necesitas agregar nuevas tablas o columnas:
1. Ve a https://supabase.com/dashboard/project/mhvbsyacicntniapishp/sql/new
2. Escribe el SQL de migración (siempre `ALTER TABLE`, nunca `DROP`)
3. Ejecuta y verifica
4. Haz el deploy del frontend

---

## 📧 Configurar emails en Supabase
1. Ve a Authentication → Email Templates
2. Personaliza los emails de bienvenida, recuperación de contraseña, etc.

## 🔐 Administradores
Los emails admin se configuran en `.env`:
```
VITE_ADMIN_EMAILS=omaralanvm@gmail.com,sunovamkt@gmail.com
```
Agrega más emails separados por coma.
