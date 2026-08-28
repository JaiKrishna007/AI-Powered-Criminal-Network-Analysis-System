import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
const getD2Url = () => process.env.D2_SERVICE_URL || 'http://localhost:8001';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'investigator@demo.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        try {
          const response = await fetch(`${getD2Url()}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          });

          if (!response.ok) {
            throw new Error('Invalid credentials or user disabled');
          }

          const data = await response.json();
          // Assume D2 returns { token, user: { id, email, name, role } }
          return {
            id: data.user?.id || 'unknown',
            email: data.user?.email || credentials.email,
            name: data.user?.name || 'User',
            role: data.user?.role || 'INVESTIGATOR',
            accessToken: data.token
          };
        } catch (error) {
           throw new Error('Login failed');
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login', // Optional, we can define a custom login page
  },
  secret: process.env.NEXTAUTH_SECRET || 'fallback_secret_for_development',
};
