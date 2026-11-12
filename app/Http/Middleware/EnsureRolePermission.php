<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureRolePermission
{
    /**
     * Enforce role-based access control on server routes and API endpoints (Brief Slide 5, 13 & 16).
     */
    public function handle(Request $request, Closure $next, string ...$allowedRoles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'error' => 'UNAUTHENTICATED',
                'message' => 'Authentication token is required.',
            ], 401);
        }

        if (!empty($allowedRoles) && !in_array($user->role, $allowedRoles, true)) {
            return response()->json([
                'error' => 'FORBIDDEN',
                'message' => "Role {$user->role} is not authorized to access this resource.",
            ], 403);
        }

        return $next($request);
    }
}
