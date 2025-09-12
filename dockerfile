    # Build Stage
    FROM node:20-alpine3.18 as builder

    WORKDIR /usr/src/app

    # Install dependencies
    COPY package*.json ./
    RUN npm cache clean --force && npm install --production

    # Copy the rest of your application's code
    COPY . .

    # Production Stage
    FROM node:20-alpine3.18

    # Install pm2 globally
    RUN npm install pm2 -g

    WORKDIR /usr/src/app

    # Copy over from the build stage
    COPY --from=builder /usr/src/app ./

    # Expose the necessary port
    EXPOSE 5000

    # Default command for production
    CMD ["pm2-runtime", "start", "src/server.js"]