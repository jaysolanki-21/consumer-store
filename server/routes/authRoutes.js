import express from 'express';
import { login} from '../controllers/authController.js';

const router = express.Router();

router.post('/login', login);
// Optional: call this route once to seed admin
// router.post('/seed', async (req, res) => {
//   await seedAdmin();
//   res.json({ message: 'Admin seeded' });
// });

export default router;