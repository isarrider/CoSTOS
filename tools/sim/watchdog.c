// Charge-pump watchdog: GPIO -Rs- b (Cf to GND) -C1- a; D1 GND->a; D2 a->h; Ch, Rh at h.
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
static double Is=4e-9, nVt=1.9*0.0259;
static double id(double v){ if(v/nVt>40) v=40*nVt; return Is*(exp(v/nVt)-1); }
int main(int c,char**v){
  double f=atof(v[1]), Rs=atof(v[2]), Cf=atof(v[3]), C1=atof(v[4]), Ch=atof(v[5]), Rh=atof(v[6]);
  double T=atof(v[7]), stop=atof(v[8]); double stall0=atof(v[9]), stallL=atof(v[10]);
  double dt = fmin(fmin(2e-6, 1/(f*400)), Rs*Cf/20); double vb=0,vc1=0,vh=0,g=0,t=0,vmin=9,vmax=0,tcross[3]={-1,-1,-1};
  double thr[3]={1.45,0.65,0.3};
  while(t<T){
    int run = !(stop>0 && t>=stop) && !(t>=stall0 && t<stall0+stallL);
    if(run) g = (fmod(t*f,1.0)<0.5)?3.3:0.0;
    // node a: va = vb - vc1 ; current into C1 i1 = id(va-vh) - id(-va)  (diode currents leaving a)
    double va=vb-vc1; double i1=id(va-vh)-id(-va);
    // implicit-ish small step
    double irs=(g-vb)/Rs;
    vb += (irs - i1)/Cf*dt;
    vc1 += i1/C1*dt;
    vh += (id(va-vh) - vh/Rh)/Ch*dt;
    if(t> (stop>0?stop:T)-1.0 && t<(stop>0?stop:T)){ if(vh<vmin)vmin=vh; if(vh>vmax)vmax=vh; }
    if(stall0>0 && t>stall0 && t<stall0+stallL+0.2 && vh<vmin) vmin=vh;
    if(stop>0 && t>stop) for(int k=0;k<3;k++) if(tcross[k]<0 && vh<thr[k]) tcross[k]=t-stop;
    t+=dt;
  }
  printf("f=%g Hz: hold %.2f..%.2f V", f, vmin, vmax);
  if(stop>0) printf("  off: <1.45 V after %.2f s, <0.65 V %.2f s, <0.3 V %.2f s", tcross[0],tcross[1],tcross[2]);
  printf("\n"); return 0;
}
