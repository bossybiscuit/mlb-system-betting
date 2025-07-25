import React, { useEffect } from 'react';
import { useMemberstack } from '@memberstack/react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Login.css';

function Login() {
  const { memberstack, member } = useMemberstack();
  const navigate = useNavigate();
  const location = useLocation();

  // Debug logs
  useEffect(() => {
    console.log("Login Component – Auth State:", { 
      hasMemberstack: !!memberstack, 
      isAuthenticated: !!member, 
      memberEmail: member?.email 
    });
  }, [memberstack, member, location]);

  // Redirect if already logged in
  useEffect(() => {
    if (member) {
      console.log("Login Component – Already authenticated, redirecting");
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [member, navigate, location]);

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;

    console.log("Login Component – Attempting login for:", email);

    try {
      if (!memberstack) {
        throw new Error("Memberstack is not initialized");
      }

      const result = await memberstack.login({ email, password });
      console.log("Login Component – Login successful:", result);
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Login Component – Login failed:", error);
      alert(error.message || "Login failed. Please check your credentials.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Welcome to MLB System Betting</h2>
        <p>Please login to access premium content</p>
        
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
              minLength="6"
            />
          </div>
          
          <div className="button-group">
            <button type="submit" className="login-button">Login</button>
          </div>

          <div className="form-footer">
            <p>Don't have an account? <Link to="/signup">Sign up here</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login; 