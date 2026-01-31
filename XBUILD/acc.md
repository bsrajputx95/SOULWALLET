I have created the following plan after thorough exploration and analysis of the codebase. Follow the below plan verbatim. Trust the files and references. Do not re-verify what's written in the plan. Explore only when absolutely necessary. First implement all the proposed file changes and then I'll review all the changes together at the end.

# SoulWallet Backend Phase 2: Profile & Account Management

## Overview

Your existing backend has a minimal User model with only `id`, `username`, `email`, `password`, and `createdAt`. The frontend Account Settings UI is already built with profile fields (firstName, lastName, phone, dateOfBirth, profileImage) and account deletion functionality. This plan extends the backend to support these features using the same Express 5 + Prisma + bcryptjs + JWT stack you already have.

## Approach

The implementation follows your existing patterns: single-file server architecture, Zod validation schemas, JWT middleware, and bcrypt password hashing. Profile fields are added as optional columns to the User model. The `dateOfBirth` and `profileImage` are stored as strings (YYYY-MM-DD format and URL respectively) to keep the database simple. The `/me` endpoint is updated to return all profile fields, and new endpoints handle profile updates, password changes, and account deletion with password verification.

## Implementation Steps

### 1. Update Prisma Schema

**File:** `file:soulwallet-backend/prisma/schema.prisma`

Replace the existing `User` model with:

```prisma
model User {
  id           String   @id @default(cuid())
  username     String   @unique
  email        String   @unique
  password     String
  firstName    String?
  lastName     String?
  phone        String?
  dateOfBirth  String?  // YYYY-MM-DD format
  profileImage String?  // URL to image
  currency     String   @default("USD")
  language     String   @default("en")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([username])
  @@index([email])
}
```

**Run migration:**

```bash
cd soulwallet-backend
npx prisma migrate dev --name add_profile_fields
npx prisma generate
```

### 2. Add Validation Schemas to server.ts

**File:** `file:soulwallet-backend/src/server.ts`

Add these schemas after the existing `loginSchema` (around line 72):

```typescript
const profileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  phone: z.string().optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  profileImage: z.string().url().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6)
});

const deleteAccountSchema = z.object({
  password: z.string().min(1)
});
```

### 3. Update GET /me Endpoint

**File:** `file:soulwallet-backend/src/server.ts`

Replace the existing `/me` endpoint (lines 224-250) with:

```typescript
// GET /me (Protected)
app.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                dateOfBirth: true,
                profileImage: true,
                currency: true,
                language: true,
                createdAt: true,
            },
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({
            success: true,
            user,
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

### 4. Add New Endpoints

**File:** `file:soulwallet-backend/src/server.ts`

Add these endpoints after the `/me` endpoint (before the `/health` endpoint around line 252):

```typescript
// PUT /profile (Protected)
app.put('/profile', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const data = profileSchema.parse(req.body);

        const user = await prisma.user.update({
            where: { id: req.userId },
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                dateOfBirth: data.dateOfBirth,
                profileImage: data.profileImage
            },
            select: {
                id: true,
                username: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                dateOfBirth: true,
                profileImage: true,
                currency: true,
                language: true,
            },
        });

        res.json({
            success: true,
            user,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/reset-password (Protected)
app.post('/auth/reset-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.userId }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Current password is incorrect' });
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: req.userId },
            data: { password: hashedPassword }
        });

        res.json({
            success: true,
            message: 'Password updated successfully'
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        console.error('Password change error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /account/delete (Protected)
app.post('/account/delete', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { password } = deleteAccountSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.userId }
        });

        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            res.status(401).json({ error: 'Password is incorrect' });
            return;
        }

        await prisma.user.delete({
            where: { id: req.userId }
        });

        res.json({
            success: true,
            message: 'Account deleted permanently'
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({
                error: error.issues[0]?.message || 'Validation failed',
            });
            return;
        }

        console.error('Account deletion error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

### 5. Frontend Integration Points

Your frontend already has the UI components built. Here are the integration points:

#### Update Home Screen to Display Real Username

**File:** `file:app/(tabs)/index.tsx`

Add a `useEffect` to fetch user data on mount:

```typescript
const [username, setUsername] = useState('demo_user');

useEffect(() => {
  const loadUser = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;
      
      const response = await fetch(`${API_URL}/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await response.json();
      
      if (json.success) {
        setUsername(json.user.username);
      }
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };
  
  loadUser();
}, []);
```

#### Update Account Settings Save Handler

**File:** `file:app/account.tsx`

Update the `updateProfile` function (line 50):

```typescript
const updateProfile = async (data: any) => {
  try {
    const token = await SecureStore.getItemAsync('token');
    const response = await fetch(`${API_URL}/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        dateOfBirth: data.dateOfBirth,
        profileImage: data.profileImage
      })
    });
    
    const json = await response.json();
    
    if (!response.ok) {
      throw new Error(json.error || 'Failed to update profile');
    }
    
    return json;
  } catch (error) {
    throw error;
  }
};
```

#### Implement Reset Password Handler

**File:** `file:app/account.tsx`

Update the "Reset Password" button handler (line 341):

```typescript
onPress={async () => {
  Alert.prompt(
    'Reset Password',
    'Enter your current password',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Next',
        onPress: async (currentPassword) => {
          if (!currentPassword) return;
          
          Alert.prompt(
            'New Password',
            'Enter your new password (min 6 characters)',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Update',
                onPress: async (newPassword) => {
                  if (!newPassword || newPassword.length < 6) {
                    Alert.alert('Error', 'Password must be at least 6 characters');
                    return;
                  }
                  
                  try {
                    const token = await SecureStore.getItemAsync('token');
                    const response = await fetch(`${API_URL}/auth/reset-password`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        currentPassword,
                        newPassword
                      })
                    });
                    
                    const json = await response.json();
                    
                    if (response.ok) {
                      Alert.alert('Success', 'Password updated successfully');
                    } else {
                      Alert.alert('Error', json.error || 'Failed to update password');
                    }
                  } catch (error) {
                    Alert.alert('Error', 'Failed to update password');
                  }
                }
              }
            ],
            'secure-text'
          );
        }
      }
    ],
    'secure-text'
  );
}}
```

#### Update Delete Account Handler

**File:** `file:app/account.tsx`

Update the `deleteAccountMutation` object (line 61):

```typescript
const deleteAccountMutation = {
  mutateAsync: async (params: { password: string }) => {
    const token = await SecureStore.getItemAsync('token');
    const response = await fetch(`${API_URL}/account/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ password: params.password })
    });
    
    const json = await response.json();
    
    if (!response.ok) {
      throw new Error(json.error || 'Failed to delete account');
    }
    
    // Clear local storage
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user_data');
    
    return json;
  },
  isPending: false,
};
```

### 6. API Endpoints Summary

| Endpoint | Method | Auth | Request Body | Response |
|----------|--------|------|--------------|----------|
| `/me` | GET | Required | - | Full user profile with all fields |
| `/profile` | PUT | Required | `{firstName?, lastName?, phone?, dateOfBirth?, profileImage?}` | Updated user object |
| `/auth/reset-password` | POST | Required | `{currentPassword, newPassword}` | Success message |
| `/account/delete` | POST | Required | `{password}` | Deletion confirmation |

### 7. Testing Checklist

After deployment, test these flows:

1. **Login** → Home screen displays `@your_actual_username` instead of `@demo_user`
2. **Account Settings** → Update firstName, lastName, phone, dateOfBirth → Save → Verify changes persist
3. **Profile Image** → Upload image to external service (Firebase/Cloudinary) → Save URL → Verify image displays
4. **Reset Password** → Enter current password → Enter new password → Verify login with new password
5. **Delete Account** → Enter password → Type "DELETE MY ACCOUNT" → Verify account deleted and logged out

### 8. Deployment

Push changes to Railway:

```bash
git add .
git commit -m "Add profile management and account deletion"
git push
```

Railway will automatically:
- Run `npx prisma migrate deploy` to apply schema changes
- Rebuild and restart the server

### 9. Important Notes

- **Date Format**: Frontend must send dates as `"YYYY-MM-DD"` strings (e.g., `"1990-01-01"`)
- **Profile Image**: Store only the URL string. Implement actual image upload to Firebase Storage or Cloudinary separately
- **Currency/Language**: Currently stored as strings with defaults (`USD`, `en`). Can be extended later without schema changes
- **Password Security**: Uses bcrypt with 10 salt rounds (same as existing auth)
- **Token Expiration**: JWT tokens expire after 30 days (existing behavior)