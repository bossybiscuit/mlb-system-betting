import React from 'react';
import { useMemberstack } from '@memberstack/react';
import './Login.css';

function Login() {
  const { memberstack } = useMemberstack();

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      await memberstack.login({
        email,
        password,
      });
    } catch (error) {
      console.error('Login failed:', error);
      alert('Login failed. Please check your credentials.');
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      await memberstack.signup({
        email,
        password,
      });
    } catch (error) {
      console.error('Signup failed:', error);
      alert('Signup failed. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Welcome to MLB Travel Schedule Tracker</h2>
        <p>Please login or sign up to access premium content</p>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              required
              placeholder="Enter your email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              placeholder="Enter your password"
            />
          </div>
          
          <div className="button-group">
            <button type="submit" className="login-button">Login</button>
            <button type="button" onClick={handleSignup} className="signup-button">Sign Up</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login; 