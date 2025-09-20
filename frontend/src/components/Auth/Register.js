import React, { useState } from 'react';
import { signUp } from '../../config/supabase';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: ''
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await signUp(formData.email, formData.password, {
        username: formData.username
      });
      
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success('Registration successful!');
      navigate('/chat');
    } catch (error) {
      toast.error('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          Create Account
        </h2>
        <form className="space-y-6" onSubmit={handleSubmit}>
          <input
            name="username"
            type="text"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Username"
            value={formData.username}
            onChange={handleChange}
          />
          <input
            name="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
          />
          <input
            name="password"
            type="password"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="Password"
            value={formData.password}
            onChange={handleChange}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-indigo-600 hover:text-indigo-500"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register;
