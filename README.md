the deployment on heroku part of course..

added engines part in package.json, heroku will use that version of node when it installs that on that remote server.

Procfile added for heroku

--heroku doesnt offer compression on the fly, so make sure to use conpression package

--we wont be using our own ssl setup (cert and pvt key also), we will do that through heroku's managed server, so only make normal http server. So commented that part from code.

--we have added node_modules in gitignore, as hosting providers install the dependencies on the server after deployment. .env also there in gitignore, as we'll set env variables thru heroku cli or dashboard.
server.cert, server.key also added to gitignore (log file removed from gitignore, it wasnt in vid as well..)