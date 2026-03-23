import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/client.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Vérifie si l'utilisateur existe déjà
        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          // Vérifie si l'email est déjà utilisé avec un compte classique
          const existingUser = await User.findOne({
            email: profile.emails[0].value,
          });
          if (existingUser) {
            // Lie le compte Google au compte existant
            existingUser.googleId = profile.id;
            await existingUser.save();
            return done(null, existingUser);
          }

          // Crée un nouvel utilisateur
          user = await User.create({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails[0].value,
            // pas de password car compte Google
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    },
  ),
);

// Pas de session — on utilise JWT
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

export default passport;
