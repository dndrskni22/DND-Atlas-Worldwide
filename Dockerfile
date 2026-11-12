FROM php:8.3-cli-alpine

# Install system dependencies, PHP PDO MySQL extension, Composer, and Node.js 22
RUN apk add --no-cache \
    bash \
    curl \
    git \
    unzip \
    libzip-dev \
    oniguruma-dev \
    mysql-client \
    nodejs \
    npm \
  && docker-php-ext-install pdo pdo_mysql mbstring zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000 8000

CMD ["npm", "run", "start"]
