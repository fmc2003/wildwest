const session = require('express-session');
const path = require('path');
const express = require('express');
const { engine } = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

//{username, password}
const users = [];
//{author, text, creationTimestamp}
const comments = [];
//{user, sessionId, expires}
const sessions = [];

app.use(express.urlencoded({ extended: true }));

//session call
//purposely insecure
app.use(session({
  secret: 'not-a-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

//Handlebars setup
app.engine('hbs', engine({
  extname: '.hbs',
  partialsDir: path.join(__dirname, 'public/views/partials')  
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'public/views')); 

app.use(express.static(path.join(__dirname, 'public')));

//returns current user
function currentUser(req) {
  return req.session.user || null;
}

//login
app.get('/login', (req, res) => {
  res.render('login', { title: 'Login Page' });
});

app.post('/login', (req, res) => {
  //find user with matching username and password to entered fields
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  //fails if no user matches
  if (!user) {
    return res.render('login', { title: 'Login', error: 'Invalid credentials' });
  }
  //session user set to username
  req.session.user = username; 
  res.redirect('/comments');   
});

//logout
app.post('/logout', (req, res) => {
  //delete session on logout
  req.session.destroy(() => res.redirect('/'));
});

//register
app.get('/register', (req, res) => {
  res.render('register', { title: 'Register Page' });
});

//registration
app.post('/register', (req, res) => {
  //fields to be input same form as user
  const { username, password } = req.body;
  //empty field check
  if (!username || !password) {
    return res.render('register', { title: 'Register', error: 'Please fill in all fields' });
  }
  //duplicate username handling
  if (users.find(u => u.username === username)) {
    return res.render('register', { title: 'Register', error: 'Username taken' });
  }
  //add user to list and redirect to login
  users.push({ username, password });
  res.redirect('/login');
});

//home
app.get('/', (req, res) => {
  res.render('home', { title: 'Home Page' });
});

//comments
app.get('/comments', (req, res) => {
  //render the list of comments
  res.render('comments', { 
    title: 'Comment Page', 
    comments, 
    user: req.session.user 
  });
});


//new comment
app.get('/new-comment', (req, res) => {
  if (!currentUser(req))
    return res.redirect('/login');
  //comments are all titled new comment
  res.render('new_comment', { title: 'New Comment' });
});

//comment posting
app.post('/comment', (req, res) => { 
  if (!currentUser(req))
    return res.redirect('/login');

  const text = (req.body.text || '').trim(); 
  //error if empty
  if (!text) { 
    return res.render('new_comment', {
      title: 'New Comment', error: 'Comment cannot be empty' 
    }); 
  } 
  //send comment with new date created when posted for timestamps
  comments.push({ 
    author: currentUser(req), text, createdAt: new Date() 
  }); 
  res.redirect('/comments'); 
});


app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
