export default function checkPayment(options = {}) {
  // options:
  //  - allowRoles: array of roles that skip the payment check (optional)
  //  - whitelist: array of route paths (string prefixes) to skip check (optional)
  const { allowRoles = [], whitelist = [] } = options;

  return async (req, res, next) => {
    try {
      // If no authenticated user, reject (this middleware assumes authenticate ran first)
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          status: 401,
          message: "Authentication required.",
        });
      }

      // Allow specific roles (e.g., super_admin) to bypass payment check
      if (allowRoles && allowRoles.includes(user.role)) return next();

      // Allow whitelisted paths (prefix match). Example: ['/public','/docs']
      if (whitelist && whitelist.some((p) => req.path.startsWith(p))) return next();

      // If user has isPayment true, allow
      if (user.isPayment) {
        return next();
      }

      // Otherwise block access
      // 402 Payment Required is semantically correct; you can use 403 if you prefer
      return res.status(402).json({
        status: 402,
        message: "Payment required. Please complete subscription to access this resource.",
        needsPayment: true,
      });
    } catch (err) {
      console.error("checkPayment middleware error:", err);
      return res.status(500).json({
        status: 500,
        message: "Server error while checking payment status",
      });
    }
  };
}
