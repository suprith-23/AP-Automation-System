# Use a lightweight Node.js alpine image to minimize storage
FROM node:20-alpine

# Set working directory inside container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy all frontend files
COPY . .

# Build the Next.js app for production
RUN npm run build

# Expose Next.js port
EXPOSE 3000

# Start Next.js in production mode
CMD [ "npm", "run", "start" ]