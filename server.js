const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3001;

// --- Plik z kontami ---
const kontaPath = path.join(__dirname, 'kontakta.txt');

// --- Middleware ---
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'supersekretnyklucz',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Google OAuth2 Setup (dodaj swoje dane z Google Console) ---
passport.use(new GoogleStrategy({
  clientID: 'TWÓJ_GOOGLE_CLIENT_ID',
  clientSecret: 'TWÓJ_GOOGLE_CLIENT_SECRET',
  callbackURL: 'http://localhost:3001/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  // Po zalogowaniu
  const userGoogleId = profile.id;
  let users = readUsers();
  let user = users.find(u => u.googleId === userGoogleId);
  if (!user) {
    // Dodaj nowego usera z rolą user
    user = {
      id: generateId(),
      googleId: userGoogleId,
      nick: profile.displayName || 'GoogleUser',
      avatar: profile.photos?.[0]?.value || '',
      rank: 'user',
      tag: 'usr',
      banner: '',
      password: '',
    };
    users.push(user);
    saveUsers(users);
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const users = readUsers();
  const user = users.find(u => u.id === id);
  done(null, user);
});

// --- Read and Write Users ---
function readUsers() {
  if (!fs.existsSync(kontaPath)) return [];
  const data = fs.readFileSync(kontaPath, 'utf-8');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(kontaPath, JSON.stringify(users, null, 2));
}

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// --- Create owner account if not exists ---
function createOwner() {
  let users = readUsers();
  if (!users.find(u => u.nick === 'owner')) {
    users.push({
      id: generateId(),
      googleId: '',
      nick: 'owner',
      avatar: '',
      rank: 'owner',
      tag: 'ownr',
      banner: '',
      password: 'owner123'
    });
    saveUsers(users);
  }
}
createOwner();

// --- Routes for Google OAuth ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('http://localhost:3000');
  }
);

// --- Middleware to check auth ---
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Not authenticated' });
}

// --- Simple API endpoints for users ---
app.get('/api/user', ensureAuth, (req, res) => {
  res.json(req.user);
});

// --- Admin panel APIs, post upload, comments etc will go here (simplified for demo) ---

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
