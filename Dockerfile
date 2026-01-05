# Development Dockerfile
FROM node:20-alpine3.18

WORKDIR /usr/src/app

# Install nodemon globally for development
RUN npm install -g nodemon

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm cache clean --force && npm install

# Copy the rest of your application's code
COPY . .

# Expose the necessary port
EXPOSE 5000

# Default command for development (can be overridden in docker-compose)
CMD ["npm", "start"]
