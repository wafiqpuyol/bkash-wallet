"use server"

import { prisma } from "@repo/db/client"
import { wallet } from "@repo/db/type"
import { authOptions } from "@repo/network"
import { getServerSession } from "next-auth"
import { sign } from 'jsonwebtoken';
import { randomBytes } from "crypto";
import { sendEmergencyCodeMail } from "./mail"


export const generatePincode = async (pincode: string) => {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.uid) {
            return { message: "Unauthorized. Please login first", status: 401 }
        }

        const isUserExist = await prisma.user.findFirst({ where: { id: session.user.uid } })
        if (!isUserExist) {
            return { message: "User not found. Please login first", status: 401 }
        }
        if (!isUserExist.isVerified) {
            return { message: "Please verify your account bewfore creating a pincode", status: 401 }
        }

        if (isNaN(parseInt(pincode))) {
            return { message: "Please enter a valid pincode", status: 400 }
        }

        const wallet = await prisma.wallet.findFirst({ where: { userId: isUserExist.id } })
        if (wallet && wallet.pincode) {
            return { message: "You already have a pincode, can't create another. If you forget your pincode, please click on forgot pincode.", status: 400 }
        }

        const encryptedPin = sign(pincode, isUserExist.password)
        await prisma.wallet.create({ data: { userId: isUserExist.id, pincode: encryptedPin } })

        return { message: "Pincode has created successfully", status: 201 }
    } catch (error) {
        console.log("generatePincode -->", error)
        return { message: "Something went wrong while creating pincode", status: 500 }
    }
}

export const sendEmergencyCode = async (email: string) => {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.uid) {
            return { message: "Unauthorized. Please login first", status: 401 }
        }

        const isUserExist = await prisma.user.findFirst({ where: { AND: [{ id: session.user.uid }, { email }] } })
        if (!isUserExist) {
            return { message: "User does not exist with this email", status: 401 }
        }

        if (!isUserExist.isVerified) {
            return { message: "Please verify your email first to request a emergency code.", status: 401 }
        }

        const wallet = await prisma.wallet.findFirst({ where: { userId: isUserExist.id } })
        if (!wallet?.pincode) {
            return { message: "You haven't created any pincode yet", status: 401 }
        }
        const emergencyCode = randomBytes(25).toString("hex");
        await prisma.wallet.update({
            where: { userId: isUserExist.id }, data: {
                emergency_code: emergencyCode,
                emergency_code_expiresAt: new Date(Date.now() + 1000 * 30),
            }
        })
        return await sendEmergencyCodeMail(isUserExist.email!, emergencyCode)
    } catch (error) {
        console.log("sendEmergencyCode -->", error)
        return { message: "Something went wrong while sending emergency code", status: 500 }
    }
}

export const resetPin = async (emergency_code: string) => {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user?.uid) {
            return { message: "Unauthorized. Please login first", status: 401 }
        }

        const isUserExist = await prisma.user.findFirst({ where: { id: session.user.uid } })
        if (!isUserExist) {
            return { message: "User does not exist with this email", status: 401 }
        }

        if (!isUserExist.isVerified) {
            return { message: "Please verify your email to reset your pincode. Please verify your email first.", status: 401 }
        }

        const wallet = await prisma.wallet.findFirst({ where: { userId: isUserExist.id } }) as wallet
        if (wallet.emergency_code !== emergency_code) {
            return { message: "Invalid emergency code. Please restart the process", status: 400 }
        }
        if (wallet.emergency_code_expiresAt! < new Date()) {
            await prisma.wallet.update({ where: { userId: isUserExist.id }, data: { emergency_code: null, emergency_code_expiresAt: null } })
            return { message: "Emergency code has expired", status: 400 }
        }

        await prisma.wallet.delete({
            where: { userId: isUserExist.id }
        })
        return { message: "Pincode has been reset successfully. Now you can create a new pincode.", status: 200 }
    } catch (error) {
        console.log("sendEmergencyCode -->", error)
        return { message: "Something went wrong while resetting pin", status: 500 }
    }
} 
