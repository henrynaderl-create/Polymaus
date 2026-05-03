import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Hero } from '../components/sections/Hero';
import { Problem } from '../components/sections/Problem';
import { WhatYouGet } from '../components/sections/WhatYouGet';
import { HowItWorks } from '../components/sections/HowItWorks';
import { Pricing } from '../components/sections/Pricing';
import { Founder } from '../components/sections/Founder';
import { CtaRepeat } from '../components/sections/CtaRepeat';
import { EmailCapture } from '../components/sections/EmailCapture';

type Props = { onBookCall: () => void };

export function Home({ onBookCall }: Props) {
  return (
    <>
      <Nav onBookCall={onBookCall} variant="home" />
      <main>
        <Hero onBookCall={onBookCall} />
        <Problem />
        <WhatYouGet />
        <HowItWorks />
        <Pricing onBookCall={onBookCall} />
        <Founder />
        <CtaRepeat onBookCall={onBookCall} />
        <EmailCapture />
      </main>
      <Footer onBookCall={onBookCall} />
    </>
  );
}
