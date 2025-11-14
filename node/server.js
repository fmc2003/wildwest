const session = require('express-session');
const path = require('path');
const express = require('express');
const { engine } = require('express-handlebars');

const app = express();
const PORT = process.env.PORT || 3000;

const users = [];//{ username, password }
const comments = [];//{ author, text, createdAt }
const sessions = [];//{ user, sessionId, expires }

app.use(express.urlencoded({ extended: true }));

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
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.render('login', { title: 'Login', error: 'Invalid credentials' });
  }

  req.session.user = username; 
  res.redirect('/comments');   
});

//logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

//register
app.get('/register', (req, res) => {
  res.render('register', { title: 'Register Page' });
});

//registration
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('register', { title: 'Register', error: 'Please fill in all fields' });
  }

  if (users.find(u => u.username === username)) {
    return res.render('register', { title: 'Register', error: 'Username taken' });
  }

  users.push({ username, password });
  res.redirect('/login');
});

//home
app.get('/', (req, res) => {
  res.render('home', { title: 'Home Page' });
});

//comments
app.get('/comments', (req, res) => {
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

  res.render('new_comment', { title: 'New Comment' });
});

//comment posting
app.post('/comment', (req, res) => { 
  if (!currentUser(req))
    return res.redirect('/login');

  const text = (req.body.text || '').trim(); 
  if (!text) { 
    return res.render('new_comment', {
      title: 'New Comment', error: 'Comment cannot be empty' 
    }); 
  } 
  comments.push({ 
    author: currentUser(req), text, createdAt: new Date() 
  }); 
  res.redirect('/comments'); 
});



app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
