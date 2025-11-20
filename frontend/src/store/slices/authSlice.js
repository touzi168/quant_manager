import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../api';

// 从localStorage恢复状态
const getInitialState = () => {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  
  if (token && userStr) {
    try {
      const user = JSON.parse(userStr);
      return {
        user,
        token,
        isAuthenticated: true,
      };
    } catch (e) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
  
  return {
    user: null,
    token: null,
    isAuthenticated: false,
  };
};

export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, googleCode }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/login', { email, password, google_code: googleCode });
      const { token, user } = response.data.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      return { token, user };
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '登录失败');
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async ({ email, password, nickname }, { rejectWithValue }) => {
    try {
      const response = await api.post('/auth/register', { email, password, nickname });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || '注册失败');
    }
  }
);

export const logout = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error('登出请求失败:', error);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: 'auth/logout' });
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    ...getInitialState(),
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
      });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;

