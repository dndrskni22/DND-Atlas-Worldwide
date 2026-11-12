<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AuthController
{
    /**
     * POST /api/register (Brief Slide 12)
     */
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:160', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
            'company_name' => ['nullable', 'string', 'max:160'],
            'role' => ['nullable', 'in:ADMIN,OPERATOR,CUSTOMER'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'] ?? 'CUSTOMER',
            'company_name' => $validated['company_name'] ?? 'External Logistics Partner',
            'avatar_initials' => strtoupper(substr($validated['name'], 0, 2)),
        ]);

        $token = $user->createToken('cargotrace-sanctum-token')->plainTextToken;

        return response()->json([
            'message' => 'User registered successfully.',
            'token_type' => 'Bearer',
            'access_token' => $token,
            'user' => $user,
        ], 201);
    }

    /**
     * POST /api/login (Brief Slide 12 & Slide 16)
     */
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', strtolower($validated['email']))->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'error' => 'INVALID_CREDENTIALS',
                'message' => 'Invalid email or password.',
            ], 401);
        }

        $token = $user->createToken('cargotrace-sanctum-token')->plainTextToken;

        return response()->json([
            'message' => 'Authenticated via Laravel Sanctum.',
            'token_type' => 'Bearer',
            'access_token' => $token,
            'user' => $user,
        ], 200);
    }

    /**
     * POST /api/logout (Brief Slide 12)
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Token revoked successfully.',
        ], 200);
    }

    /**
     * GET /api/user (Brief Slide 12)
     */
    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user(),
        ], 200);
    }
}
