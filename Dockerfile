FROM node:8.6

# Install Dependencies
WORKDIR /ui

# Copy over the App
COPY ./public /ui/public
COPY ./index.js /ui/
COPY ./package.json /ui/

RUN npm install express
RUN npm install morgan
CMD [ "npm", "start" ]