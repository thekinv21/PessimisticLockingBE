import type { Metadata } from 'next'
import { Golos_Text, JetBrains_Mono, Manrope } from 'next/font/google'

import { Providers } from '@/app/providers'

import './globals.css'

const manrope = Manrope({
	variable: '--font-manrope',
	subsets: ['latin', 'cyrillic'],
	weight: ['500', '600', '700', '800'],
})

const golos = Golos_Text({
	variable: '--font-golos',
	subsets: ['latin', 'cyrillic'],
	weight: ['400', '500', '600', '700'],
})

const jetbrainsMono = JetBrains_Mono({
	variable: '--font-jetbrains',
	subsets: ['latin', 'cyrillic'],
	weight: ['500', '600'],
})

export const metadata: Metadata = {
	title: {
		default: 'WebSocket Realtime',
		template: '%s · WebSocket Realtime',
	},
	description: 'WebSocket Realtime — realtime notifications',
}

type TRootLayoutProps = LayoutProps<'/'>

export default async function RootLayout({ children }: TRootLayoutProps) {
	return (
		<html
			lang={'en'}
			className={`${manrope.variable} ${golos.variable} ${jetbrainsMono.variable} h-full`}
			suppressHydrationWarning
		>
			<body className='min-h-full' suppressHydrationWarning>
				<>
					<Providers>{children}</Providers>
				</>
			</body>
		</html>
	)
}
