import React, { useEffect } from 'react';
import { useMemberstack } from '@memberstack/react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import './Login.css'; // We'll reuse the login styles

function Signup() {
  const { memberstack, member } = useMemberstack();
  const navigate = useNavigate();
  const location = useLocation();

  // Debug logs
  useEffect(() => {
    console.log("Signup Component – Auth State:", { 
      hasMemberstack: !!memberstack, 
      isAuthenticated: !!member, 
      memberEmail: member?.email 
    });
  }, [memberstack, member]);

  // Redirect if already logged in
  useEffect(() => {
    if (member) {
      console.log("Signup Component – Already authenticated, redirecting");
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    }
  }, [member, navigate, location]);

  const handleSignup = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    const confirmPassword = e.target.confirmPassword.value;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    console.log("Signup Component – Attempting signup for:", email);

    try {
      if (!memberstack) {
        throw new Error("Memberstack is not initialized");
      }

      const result = await memberstack.signup({
        email,
        password,
        // You can add additional fields here if needed
        // For example: name, custom fields, etc.
      });

      console.log("Signup Component – Signup successful:", result);
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (error) {
      console.error("Signup Component – Signup failed:", error);
      alert(error.message || "Signup failed. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2>Create Your Account</h2>
        <p>Join MLB System Betting to access premium content</p>
        
        <form onSubmit={handleSignup} className="login-form">
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

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password:</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              required
              placeholder="Confirm your password"
              minLength="6"
            />
          </div>
          
          <div className="button-group">
            <button type="submit" className="login-button">Sign Up</button>
          </div>

          <div className="form-footer">
            <p>Already have an account? <Link to="/login">Login here</Link></p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Signup; 