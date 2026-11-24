import cv2,numpy as np
U='/root/.claude/uploads/1f641398-f9de-5a22-ab83-3c1cab6a1a2d/'
C={
'lecture':('0f025945',0,0,320,180),
'k_lab':('e6985b7e',0,158,720,563),
'k_seat':('e6985b7e',14,800,353,1244),
'k_brick':('e6985b7e',370,1128,708,1514),
'g_grad':('19b7e660',14,355,353,600),
'g_brick':('19b7e660',370,422,708,656),
'g_blue':('19b7e660',14,694,353,937),
'g_wsj':('19b7e660',370,749,708,1097),
'g_grow':('19b7e660',14,1031,353,1471),
'toi':('b088c96e',0,158,720,563),
'itoday':('f74ab2c8',0,158,720,563),
'scmp':('6fa2ae17',0,158,720,878),
'wiki':('3fef580b',0,158,720,1134),
'nv':('9135fbbf',0,158,720,878),
}
import os; os.makedirs('src',exist_ok=True)
for k,(f,x0,y0,x1,y1) in C.items():
    im=cv2.imread(U+f+'-image.jpg')[y0:y1,x0:x1]; cv2.imwrite(f'src/{k}.png',im); print(k,im.shape)
