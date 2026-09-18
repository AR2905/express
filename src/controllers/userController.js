import User from '../models/User.js';
import IdempotencyKey from '../models/IdempotencyKey.js';

const findByIdempotencyKey = async (key) => {
  const record = await IdempotencyKey.findOne({ key }).populate('userId');
  return record?.userId;
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  try {
    if (key) {
      const existing = await findByIdempotencyKey(key);
      if (existing) {
        return res.status(200).json({ success: true, data: existing, duplicate: true });
      }
    }

    const user = await User.create(req.body);
    if (key) await IdempotencyKey.create({ key, userId: user._id });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error?.code === 11000 && key) {
      const existing = await findByIdempotencyKey(key);
      if (existing) {
        return res.status(200).json({ success: true, data: existing, duplicate: true });
      }
    }
    next(error);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
};