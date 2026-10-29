const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../db/database");

// ======================
// Register
// ======================
router.post("/register", async (req, res) => {

    try {

        const { username, email, password } = req.body;

        const [existing] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (existing.length > 0) {

            return res.status(400).json({
                message: "Email already registered"
            });

        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.query(
            "INSERT INTO users(username,email,password) VALUES(?,?,?)",
            [username, email, hashedPassword]
        );

        res.json({
            message: "User registered successfully"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server Error"
        });

    }

});

// ======================
// Login
// ======================
router.post("/login", async (req, res) => {

    try {

        const { email, password } = req.body;

        const [users] = await db.query(
            "SELECT * FROM users WHERE email = ?",
            [email]
        );

        if (users.length === 0) {

            return res.status(404).json({
                message: "User not found"
            });

        }

        const user = users[0];

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {

            return res.status(401).json({
                message: "Invalid Password"
            });

        }

        const token = jwt.sign(

            {
                id: user.id,
                email: user.email
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "2h"
            }

        );

        res.json({

            message: "Login Successful",

            token

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            message: "Server Error"
        });

    }

});

module.exports = router;