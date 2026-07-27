import type { Metadata } from 'next'
import { DM_Sans, Manrope } from 'next/font/google'
import './partner.css'
import './interactions.css'
const display=Manrope({subsets:['latin'],variable:'--display'})
const body=DM_Sans({subsets:['latin'],variable:'--body'})
export const metadata:Metadata={title:'ASAX Partner Console'}
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body className={`${display.variable} ${body.variable}`}>{children}</body></html>}
