# Use the Node.js 18 image as the base
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the app
COPY . .

# Expose the port
EXPOSE 8080

# Start the application
CMD ["node", "index.js"]
