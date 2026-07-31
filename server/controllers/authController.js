import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    
    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is deactivated. Please contact admin.' });
    }
    
    // ✅ Build response with all fields
    const response = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id)
    };
    
    // ✅ Always include counterId if role is counter
    if (user.role === 'counter') {
      response.counterId = user.counterId;
      // Generate counter name if not exists
      const counterNames = {
        'counter-1': 'Counter 1',
        'counter-2': 'Counter 2',
        'counter-3': 'Counter 3',
        'counter-4': 'Counter 4',
        'counter-5': 'Counter 5',
        'counter-6': 'Counter 6',
        'counter-7': 'Counter 7',
        'counter-8': 'Counter 8',
        'counter-9': 'Counter 9',
        'counter-10': 'Counter 10',
      };
      response.counterName = counterNames[user.counterId] || `Counter ${user.counterId?.split('-')[1] || '1'}`;
    }
    
    // ✅ Update last login
    user.lastLogin = new Date();
    await user.save();
     
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};