import React, { useEffect, useState } from 'react';
import { useMemberstack } from '@memberstack/react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Login.css';

function Login() {
  const { memberstack, member } = useMemberstack();
  const navigate = useNavigate();
  const location = useLocation();
  const [formAction, setFormAction] = useState('login');

  // Debug logs (optional)
  useEffect(() => {
    console.log("Login Component – Auth State:", { hasMemberstack: !!memberstack, isAuthenticated: !!member, memberEmail: member?.email, from: location.state?.from?.pathname || "/" });
  }, [memberstack, member, location]);

  // Redirect if already logged in
  useEffect(() => {
    if (member) {
      console.log("Login Component – Already authenticated, redirecting");
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [member, navigate, location]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    console.log(`Login Component – Attempting ${formAction} for:`, email);

    try {
      const result = formAction === 'login' 
        ? await memberstack.login({ email, password })
        : await memberstack.signup({ email, password });
      
      console.log(`Login Component – ${formAction} successful:`, result);
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (error) {
      console.error(`Login Component – ${formAction} failed:`, error);
      alert(error.message || `${formAction === 'login' ? 'Login' : 'Signup'} failed. Please try again.`);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Welcome to MLB System Betting</h2>
        <p>Please login or sign up to access premium content</p>
        
        <form onSubmit={handleSubmit} className="login-form">
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
              minLength="6"
            />
          </div>
          
          <div className="button-group">
            <button 
              type="submit" 
              className={`login-button ${formAction === 'login' ? 'active' : ''}`}
              onClick={() => setFormAction('login')}
            >
              Login
            </button>
            <button 
              type="submit" 
              className={`signup-button ${formAction === 'signup' ? 'active' : ''}`}
              onClick={() => setFormAction('signup')}
            >
              Sign Up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login; 