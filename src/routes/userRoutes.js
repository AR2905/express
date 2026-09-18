import express, { Router } from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/userController.js';

const router = Router();

router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

export default router;