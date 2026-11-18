import redis from "../../shared/redis/redis.js"



export const isAuth = async (req,res,next) => {
    try {
        const sessionId = req.cookies?.session

        if(!sessionId){
            return res.status(401).json({message:"Unauthorized"})
        }

        const session =await redis.get(`session:${sessionId}`)

        if(!session){
            return res.status(401).json({message:"Session Expired"})
        }

        req.user = JSON.parse(session);

        // Gateway Account Status Enforcement (P1-06)
        if (req.user && req.user.status === "suspended") {
            return res.status(403).json({
                success: false,
                message: "Account suspended: Access denied.",
            });
        }

        next();

    } catch (error) {
         return res.status(500).json({message:error.message});
    }
}