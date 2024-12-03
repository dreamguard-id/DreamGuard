FROM node:20
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
