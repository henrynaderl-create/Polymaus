import { useCallback, useState } from 'react';
import { Home } from './pages/Home';
import { Partners } from './pages/Partners';
import { IntakeModal } from './components/IntakeModal';
import { useScrollReveal } from './hooks/useScrollReveal';
import { usePath } from './lib/router';

export default function App() {
  const path = usePath();
  const [intakeOpen, setIntakeOpen] = useState(false);

  const openIntake = useCallback(() => setIntakeOpen(true), []);
  const closeIntake = useCallback(() => setIntakeOpen(false), []);

  useScrollReveal();

  const isPartners = path.startsWith('/partners');

  return (
    <>
      {isPartners ? (
        <Partners onBookCall={openIntake} />
      ) : (
        <Home onBookCall={openIntake} />
      )}
      <IntakeModal open={intakeOpen} onClose={closeIntake} />
    </>
  );
}
