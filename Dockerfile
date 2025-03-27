# Use an official Node.js base image.  Choose the LTS version for stability.
FROM node:22-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if you have one)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of your project files
COPY . .

# Expose the port your Vite app runs on (usually 3000)
EXPOSE 3000

# Command to run Vite. This is critical.  Use the command you normally use to start Vite.
CMD ["npm", "run", "dev"]
