import './framer/styles.css'

import CtaSectionFramerComponent from './framer/cta-section'
import LogoBoxFramerComponent from './framer/logo-box'
import AvailabilityFramerComponent from './framer/availability'
import MainButtonFramerComponent from './framer/main-button'
import SocialMediaFramerComponent from './framer/elements/social-media'

export default function App() {
  return (
    <div className='flex flex-col items-center gap-3 bg-[rgb(4,_7,_13)]'>
      <CtaSectionFramerComponent.Responsive/>
      <LogoBoxFramerComponent.Responsive/>
      <AvailabilityFramerComponent.Responsive
        jn909WTNI={"NEW GEN AI AUTOMATION PARTNER"}
        tCgMNdSJ8={"not available"}
      />
      <MainButtonFramerComponent.Responsive
        WygjbYACO={"Book A Free Call"}
        pkd7Pcy3s={true}
        ypOX2jdFN={"https://framer.link/D4dc7gs"}
      />
      <SocialMediaFramerComponent.Responsive
        YdTA2k7Lp={"https://x.com/home"}
      />
    </div>
  );
};